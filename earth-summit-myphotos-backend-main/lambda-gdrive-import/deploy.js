const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FUNCTION_NAME = "myphotos-gdrive-import-processor";
const ROLE_NAME = "MyPhotosGDriveImportLambdaRole";
const REGION = "ap-south-1";
const ZIP_FILE = "function.zip";

function run(command) {
  console.log(`Running: ${command}`);
  try {
    return execSync(command, { stdio: "pipe", encoding: "utf-8" }).trim();
  } catch (e) {
    console.error(`Command failed: ${command}`);
    console.error(e.stderr || e.message);
    throw e;
  }
}

async function main() {
  console.log("Starting deployment...");

  // 1. Install dependencies
  console.log("Installing dependencies...");
  run("npm install --arch=x64 --platform=linux sharp");

  // 2. Zip files
  console.log("Zipping files...");
  if (fs.existsSync(ZIP_FILE)) fs.unlinkSync(ZIP_FILE);

  // Use tar on Windows (available in modern Windows) or zip on Linux
  const isWindows = process.platform === "win32";
  if (isWindows) {
    // Exclude .git, node_modules/.bin, etc. is hard with basic tar, but we try our best
    // Using tar -a -c -f function.zip *
    // Note: This might include unwanted files if not careful, but for now it's better than nothing.
    // Better approach: use powershell if tar fails or just use tar.
    try {
      run(`tar -a -c -f ${ZIP_FILE} *`);
    } catch (e) {
      console.log("tar failed, trying PowerShell Compress-Archive...");
      run(
        `powershell Compress-Archive -Path * -DestinationPath ${ZIP_FILE} -Force`
      );
    }
  } else {
    run(`zip -r ${ZIP_FILE} . -x "*.git*"`);
  }

  // 3. Get Role ARN
  console.log("Fetching Role ARN...");
  let roleArn;
  try {
    roleArn = JSON.parse(
      run(`aws iam get-role --role-name ${ROLE_NAME} --output json`)
    ).Role.Arn;
  } catch (e) {
    console.error(
      `Error getting role ${ROLE_NAME}. Make sure you created it in Step 3.1.`
    );
    process.exit(1);
  }

  // 4. Check if function exists
  console.log("Checking if function exists...");
  let functionExists = false;
  try {
    run(
      `aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION}`
    );
    functionExists = true;
  } catch (e) {
    // Ignore error, means function doesn't exist
  }

  // 5. Create or Update
  if (functionExists) {
    console.log("Updating function code...");
    run(
      `aws lambda update-function-code --function-name ${FUNCTION_NAME} --zip-file fileb://${ZIP_FILE} --region ${REGION}`
    );
    console.log("Updating function configuration...");
    run(
      `aws lambda update-function-configuration --function-name ${FUNCTION_NAME} --timeout 60 --memory-size 512 --region ${REGION}`
    );
  } else {
    console.log("Creating function...");
    // Wait a bit for role propagation if it was just created (though user likely created it earlier)
    run(
      `aws lambda create-function --function-name ${FUNCTION_NAME} --runtime nodejs18.x --handler index.handler --role ${roleArn} --zip-file fileb://${ZIP_FILE} --timeout 60 --memory-size 512 --region ${REGION}`
    );
  }

  console.log("Deployment successful!");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
