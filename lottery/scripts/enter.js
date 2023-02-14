const { ethers, getNamedAccounts } = require("hardhat");

async function enterLottery() {
    const { deployer } = await getNamedAccounts();
    const lottery = await ethers.getContract("Lottery", deployer);
    const fees = await lottery.getEntranceFees();
    console.log("Entering...");
    await lottery.enterLottery({value: fees});
    console.log("Done");
}

enterLottery()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })