const { spawn } = require('child_process');
let mainProcess;

function startMainProcess() {
    console.log('Starting main.js...');
    mainProcess = spawn('node', ['main.js'], { stdio: 'inherit' });

    mainProcess.on('exit', (code) => {
        console.log(`main.js exited with code ${code}`);
        setTimeout(startMainProcess, 5000); // Restart main.js after a 5-second delay
    });

    mainProcess.on('error', (err) => {
        console.error('Failed to start main.js:', err);
    });
}

startMainProcess(); // Start main.js initially
