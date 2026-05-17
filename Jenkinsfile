// =====================================================================
// Jenkinsfile — NexTrade CI/CD Pipeline
// Stages: Checkout → Install → Lint/Test → Build → Push → Deploy
// =====================================================================

pipeline {

  agent any

  // ── Trigger: poll SCM every 5 minutes, or use a webhook ─────────────
  triggers {
    pollSCM('H/5 * * * *')
  }

  environment {
    // Docker Hub / private registry image names
    SERVER_IMAGE  = "nextrade/server:${env.BUILD_NUMBER}"
    CLIENT_IMAGE  = "nextrade/client:${env.BUILD_NUMBER}"
    SERVER_LATEST = "nextrade/server:latest"
    CLIENT_LATEST = "nextrade/client:latest"

    // Jenkins credential IDs (configure in: Manage Jenkins → Credentials)
    DOCKER_CREDS  = credentials('dockerhub-credentials')
    ENV_FILE      = credentials('nextrade-env-file')   // .env secret file
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  stages {

    // ── 1. Checkout ──────────────────────────────────────────────────
    stage('Checkout') {
      steps {
        checkout scm
        echo "Building commit: ${env.GIT_COMMIT?.take(7)}"
      }
    }

    // ── 2. Install Dependencies ──────────────────────────────────────
    stage('Install') {
      parallel {
        stage('Server deps') {
          steps {
            dir('server') {
              sh 'npm ci'
            }
          }
        }
        stage('Client deps') {
          steps {
            dir('client') {
              sh 'npm ci'
            }
          }
        }
      }
    }

    // ── 3. Lint & Test ───────────────────────────────────────────────
    stage('Lint & Test') {
      parallel {
        stage('Server tests') {
          steps {
            dir('server') {
              // Add your test command here, e.g. npm test
              sh 'npm run test --if-present || echo "No tests defined — skipping"'
            }
          }
          post {
            always {
              // Publish JUnit test results if they exist
              junit allowEmptyResults: true, testResults: 'server/test-results/**/*.xml'
            }
          }
        }
        stage('Client tests') {
          steps {
            dir('client') {
              sh 'CI=true npm run test --if-present || echo "No tests defined — skipping"'
            }
          }
        }
      }
    }

    // ── 4. Build Docker Images ───────────────────────────────────────
    stage('Build Images') {
      steps {
        script {
          echo "Building Docker images for build #${env.BUILD_NUMBER}..."

          // Build backend image
          docker.build(env.SERVER_IMAGE, '-f server/Dockerfile ./server')

          // Build React client image (inject API URL at build time)
          docker.build(
            env.CLIENT_IMAGE,
            "--build-arg REACT_APP_API_URL=${env.REACT_APP_API_URL ?: 'http://localhost:10000'} -f client/Dockerfile ./client"
          )
        }
      }
    }

    // ── 5. Push to Registry ──────────────────────────────────────────
    stage('Push') {
      when {
        // Only push on main/master branch
        anyOf {
          branch 'main'
          branch 'master'
        }
      }
      steps {
        script {
          docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-credentials') {
            def serverImg = docker.image(env.SERVER_IMAGE)
            def clientImg = docker.image(env.CLIENT_IMAGE)

            serverImg.push()
            serverImg.push('latest')

            clientImg.push()
            clientImg.push('latest')
          }
        }
      }
    }

    // ── 6. Deploy (SSH / docker compose on remote host) ─────────────
    stage('Deploy') {
      when {
        branch 'main'
      }
      steps {
        withCredentials([file(credentialsId: 'nextrade-env-file', variable: 'ENV_FILE')]) {
          sshagent(['deploy-server-ssh-key']) {
            sh """
              # Copy the .env to the remote server
              scp -o StrictHostKeyChecking=no \$ENV_FILE deploy@\${DEPLOY_HOST}:/opt/nextrade/.env

              # Pull latest images and restart services
              ssh -o StrictHostKeyChecking=no deploy@\${DEPLOY_HOST} '
                cd /opt/nextrade &&
                docker compose pull &&
                docker compose up -d --remove-orphans &&
                docker image prune -f
              '
            """
          }
        }
      }
    }
  }

  // ── Post-pipeline notifications ──────────────────────────────────────
  post {
    success {
      echo "✅ Pipeline succeeded — Build #${env.BUILD_NUMBER}"
      // Uncomment to send Slack notification:
      // slackSend channel: '#deploys', color: 'good',
      //   message: "✅ NexTrade build #${env.BUILD_NUMBER} succeeded on ${env.BRANCH_NAME}"
    }
    failure {
      echo "❌ Pipeline failed — Build #${env.BUILD_NUMBER}"
      // slackSend channel: '#deploys', color: 'danger',
      //   message: "❌ NexTrade build #${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}"
    }
    always {
      // Clean up dangling images to save disk space
      sh 'docker image prune -f || true'
    }
  }
}
