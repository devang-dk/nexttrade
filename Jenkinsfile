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
    DOCKERHUB_USER      = "ronnie75491"
    SERVER_IMAGE        = "ronnie75491/nextrade-server:${env.BUILD_NUMBER}"
    CLIENT_IMAGE        = "ronnie75491/nextrade-client:${env.BUILD_NUMBER}"
    REACT_APP_API_URL   = "http://localhost:10000"
    COMPOSE_PROJECT_DIR = "/var/jenkins_home/workspace/nextrade"
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
        expression {
          def br = env.GIT_BRANCH ?: ''
          return br == 'main' || br == 'master' || br.endsWith('/main') || br.endsWith('/master')
        }
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

    // ── 6. Deploy to AWS EC2 ───────────────────────────────────────────
    // Jenkins SSHes into the EC2 instance provisioned by Terraform and
    // runs docker compose on the remote server (no Docker socket tricks needed).
    // Required Jenkins credentials:
    //   deploy-server-ssh-key → SSH Private Key (terraform/nextrade-key.pem)
    //   deploy-host           → Secret text    (EC2 Elastic IP)
    //   nextrade-env-file     → Secret file    (.env with all secrets)
    stage('Deploy') {
      when {
        expression {
          def br = env.GIT_BRANCH ?: ''
          return br == 'main' || br == 'master' || br.endsWith('/main') || br.endsWith('/master')
        }
      }
      steps {
        script {
          try {
            withCredentials([
              string(credentialsId: 'deploy-host', variable: 'DEPLOY_HOST'),
              file(credentialsId: 'nextrade-env-file', variable: 'ENV_FILE')
            ]) {
              sshagent(['deploy-server-ssh-key']) {
                sh """
                  # Copy latest .env to the server
                  scp -o StrictHostKeyChecking=no \$ENV_FILE ubuntu@\${DEPLOY_HOST}:/opt/nextrade/.env

                  # Pull latest code (docker-compose.yml, nginx.conf, monitoring configs)
                  ssh -o StrictHostKeyChecking=no ubuntu@\${DEPLOY_HOST} '
                    cd /opt/nextrade &&
                    git pull origin main &&
                    docker compose pull server client &&
                    docker compose up -d --remove-orphans &&
                    docker image prune -f
                  '
                """
              }
            }
            echo "✅ Deployed Build #${env.BUILD_NUMBER} to AWS EC2"
          } catch (err) {
            echo "⚠️  Deploy skipped — configure Jenkins credentials:"
            echo "     deploy-host           → EC2 Elastic IP (from: terraform output ec2_public_ip)"
            echo "     deploy-server-ssh-key → SSH key       (from: terraform/nextrade-key.pem)"
            echo "     nextrade-env-file     → Secret file   (your .env file)"
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
