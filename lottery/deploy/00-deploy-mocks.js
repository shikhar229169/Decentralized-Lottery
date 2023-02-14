const { network, ethers } = require("hardhat");
const { namedNetworks } = require("../helper-hardhat-config.js");

// 0.25 is the premium. Cost 0.25 LINK
const BASE_FEE = ethers.utils.parseEther("0.25");  

// link per gas
const GAS_PRICE_LINK = 1e9;

module.exports = async function({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    if (namedNetworks.includes(network.name)) {
        log("Deploying Mocks.....");

        await deploy("VRFCoordinatorV2Mock", {
            contract: "VRFCoordinatorV2Mock",
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK]
        });
    }
}

module.exports.tags = ["all", "mocks"];