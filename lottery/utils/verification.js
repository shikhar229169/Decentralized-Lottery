const { run } = require("hardhat");

const verifyContract = async function(contractAddress, contractArgs) {
    try {
        console.log("Starting the process to verify the contract...");
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: contractArgs
        });
        console.log("Hoooray! Your contract is verified successfully");
    }
    catch(e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("You are All set, Your contract is already verified");
        }
        else {
            console.log(e);
        }
    }
}

module.exports = { verifyContract };