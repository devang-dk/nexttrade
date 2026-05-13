#!/usr/bin/env node

/**
 * MERN Setup & Start Script
 * Provides interactive menu to:
 * 1. Install dependencies
 * 2. Start MongoDB
 * 3. Run backend server
 * 4. Run React frontend
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

const executeCommand = (command, description) => {
  return new Promise((resolve, reject) => {
    console.log(`\n[*] ${description}...`);
    exec(command, { shell: true, stdio: 'inherit' }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[!] Error: ${error.message}`);
        reject(error);
      } else {
        console.log(`[✓] ${description} complete`);
        resolve(stdout);
      }
    });
  });
};

const menu = async () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  NexTrade - MERN Stack Setup & Start         ║
║  MongoDB + Express + React + Node.js         ║
╚══════════════════════════════════════════════╝

Choose an option:
1. Install all dependencies
2. Start MongoDB (Docker)
3. Start backend server on port 8080
4. Start React frontend on port 3000
5. Start everything (backend + frontend)
6. Setup environment files
7. Exit
  `);

  const choice = await question('Enter your choice (1-7): ');

  switch (choice) {
    case '1':
      await installDependencies();
      break;
    case '2':
      await startMongo();
      break;
    case '3':
      await startBackend();
      break;
    case '4':
      await startFrontend();
      break;
    case '5':
      await startAll();
      break;
    case '6':
      await setupEnv();
      break;
    case '7':
      console.log('\nGoodbye! 👋');
      rl.close();
      return;
    default:
      console.log('Invalid choice');
  }

  // Show menu again
  setTimeout(menu, 2000);
};

const installDependencies = async () => {
  try {
    // Check if node_modules exist
    const serverModules = path.exists('./server/node_modules');
    const clientModules = path.exists('./client/node_modules');

    if (!serverModules) {
      console.log('\n[*] Installing backend dependencies...');
      await executeCommand('cd server && npm install', 'Backend dependencies');
    }

    if (!clientModules) {
      console.log('\n[*] Installing frontend dependencies...');
      await executeCommand('cd client && npm install', 'Frontend dependencies');
    }

    console.log('\n[✓] All dependencies installed!');
  } catch (error) {
    console.error('Failed to install dependencies');
  }
};

const startMongo = async () => {
  try {
    const running = await executeCommand('docker ps | findstr nextrade-mongo', 'Check MongoDB');
    if (running) {
      console.log('\n[✓] MongoDB is already running on port 27017');
    }
  } catch (error) {
    console.log('\n[*] Starting MongoDB with Docker...');
    await executeCommand(
      'docker run -d -p 27017:27017 --name nextrade-mongo mongo',
      'MongoDB Docker container'
    );
  }
};

const startBackend = async () => {
  console.log('\n[*] Starting backend server...');
  console.log('[*] Backend will run on http://localhost:8080');
  console.log('[*] API will be available at http://localhost:8080/api');
  await executeCommand('cd server && npm start', 'Backend server');
};

const startFrontend = async () => {
  console.log('\n[*] Starting React frontend...');
  console.log('[*] Frontend will open at http://localhost:3000');
  await executeCommand('cd client && npm start', 'React frontend');
};

const startAll = async () => {
  console.log('\n[*] Starting everything...');
  console.log('[*] Note: You may need multiple terminal windows for this');
  console.log('[*] Backend: npm start (in server/ folder)');
  console.log('[*] Frontend: npm start (in client/ folder)');
  console.log('[*] MongoDB: docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo');
};

const setupEnv = async () => {
  console.log('\n[*] Setting up environment files...');

  // Backend .env
  const serverEnv = `MONGODB_URI=mongodb://localhost:27017/nextrade
PORT=8080
JWT_SECRET=nextrade_jwt_secret_change_in_production
FRONTEND_URL=http://localhost:3000
NODE_ENV=development`;

  // Frontend .env
  const clientEnv = `REACT_APP_API_URL=http://localhost:8080/api`;

  fs.writeFileSync('./server/.env', serverEnv);
  console.log('[✓] Created server/.env');

  fs.writeFileSync('./client/.env', clientEnv);
  console.log('[✓] Created client/.env');

  console.log('\n[!] Important: Update these files with your actual credentials!');
};

// Start
menu().catch(console.error);
