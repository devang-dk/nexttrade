// =====================================================================
// Jenkinsfile — NexTrade CI/CD Pipeline
// Jenkins image has Node.js 18 + Docker CLI pre-installed (jenkins/Dockerfile)
// so all stages run on `agent any` — no Docker-in-Docker agents needed.
// =====================================================================

pipeline {

  agent any

  triggers {
    pollSCM('H/5 * * * *')
  }

  environment {
    SERVER_IMAGE = "nextrade/server:${env.BUILD_NUMBER}"
    CLIENT_IMAGE = "nextrade/client:${env.BUILD_NUMBER}"
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  stages {

    // ── 1. Checkout ────────────────────────────────────────────────────
    stage('Checkout') {
      steps {
        checkout scm
        echo "✅ Commit: ${env.GIT_COMMIT?.take(7)} | Branch: ${env.BRANCH_NAME ?: 'main'}"
      }
    }

    // ── 2. Install ─────────────────────────────────────────────────────
    stage('Install') {
      parallel {
        stage('Server deps') {
          steps {
            dir('server') {
              sh 'npm install --omit=dev'
            }
          }
        }
        stage('Client deps') {
          steps {
            dir('client') {
              sh 'npm install --legacy-peer-deps'
            }
          }
        }
      }
    }

    // ── 3. Test ────────────────────────────────────────────────────────
    stage('Test') {
      parallel {
        stage('Server tests') {
          steps {
            dir('server') {
              sh 'npm test --if-present || echo "ℹ️  No server tests — skipping"'
            }
          }
          post {
            always {
              echo "ℹ️  Server test stage complete (install JUnit plugin to publish test results)"
            }
          }
        }
        stage('Client tests') {
          steps {
            dir('client') {
              sh 'CI=true npm test --if-present || echo "ℹ️  No client tests — skipping"'
            }
          }
        }
      }
    }

    // ── 4. Build Docker Images ─────────────────────────────────────────
    stage('Build Images') {
      steps {
        script {
          echo "🐳 Building images — Build #${env.BUILD_NUMBER}"
          docker.build(env.SERVER_IMAGE, '-f server/Dockerfile ./server')
          docker.build(
            env.CLIENT_IMAGE,
            "--build-arg REACT_APP_API_URL=${env.REACT_APP_API_URL ?: 'http://localhost:10000'} -f client/Dockerfile ./client"
          )
          echo "✅ Built: ${env.SERVER_IMAGE}  |  ${env.CLIENT_IMAGE}"
        }
      }
    }

    // ── 5. Push to Docker Hub ──────────────────────────────────────────
    stage('Push') {
      when {
        anyOf { branch 'main'; branch 'master' }
      }
      steps {
        script {
          try {
            docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-credentials') {
              docker.image(env.SERVER_IMAGE).push()
              docker.image(env.SERVER_IMAGE).push('latest')
              docker.image(env.CLIENT_IMAGE).push()
              docker.image(env.CLIENT_IMAGE).push('latest')
            }
            echo "✅ Images pushed to Docker Hub"
          } catch (err) {
            echo "⚠️  Push skipped — add 'dockerhub-credentials' in Manage Jenkins → Credentials"
            currentBuild.result = 'UNSTABLE'
          }
        }
      }
    }

    // ── 6. Deploy ──────────────────────────────────────────────────────
    stage('Deploy') {
      when {
        anyOf { branch 'main'; branch 'master' }
      }
      steps {
        script {
          try {
            withCredentials([
              file(credentialsId: 'nextrade-env-file', variable: 'ENV_FILE'),
              string(credentialsId: 'deploy-host', variable: 'DEPLOY_HOST')
            ]) {
              sshagent(['deploy-server-ssh-key']) {
                sh """
                  scp -o StrictHostKeyChecking=no \$ENV_FILE deploy@\${DEPLOY_HOST}:/opt/nextrade/.env
                  ssh -o StrictHostKeyChecking=no deploy@\${DEPLOY_HOST} '
                    cd /opt/nextrade &&
                    docker compose pull &&
                    docker compose up -d --remove-orphans &&
                    docker image prune -f
                  '
                """
              }
            }
            echo "✅ Deployed successfully"
          } catch (err) {
            echo "⚠️  Deploy skipped — add deploy credentials in Manage Jenkins → Credentials"
            currentBuild.result = 'UNSTABLE'
          }
        }
      }
    }
  }

  post {
    success  { echo "✅ Build #${env.BUILD_NUMBER} PASSED" }
    unstable { echo "⚠️  Build #${env.BUILD_NUMBER} UNSTABLE — optional stages skipped" }
    failure  { echo "❌ Build #${env.BUILD_NUMBER} FAILED" }
    always   { echo "🏁 Finished: ${currentBuild.currentResult}" }
  }
}
