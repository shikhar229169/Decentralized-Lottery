const { namedNetworks } = require("../../helper-hardhat-config.js");
const { network, ethers, getNamedAccounts } = require("hardhat");
const { assert } = require("chai");



namedNetworks.includes(network.name) 
    ? describe.skip
    : describe("Lottery Staging Tests", function() {
        let lottery;
        let deployer;
        let fees;

        beforeEach(async function() {
            deployer = (await getNamedAccounts()).deployer;

            lottery = await ethers.getContract("Lottery", deployer);
            fees = await lottery.getEntranceFees();
        });


        describe("Fulfill Random Words", async function() {
            it("Chainlink Keepers and VRF works", async function() {
                const startingTimeStamp = await lottery.getLastTimeStamp();
                const accounts = await ethers.getSigners();
                let winnerInitialBalance;

                await new Promise(async(resolve, reject) => {
                    lottery.once("WinnerSelected", async function() {
                        try {
                            const Winner = await lottery.getRecentWinner();
                            const lotteryState = await lottery.getLotteryState();
                            const timeStamp = await lottery.getLastTimeStamp();
                            const winnerFinalBalance = await accounts[0].getBalance();
                            const participants = await lottery.getNumberOfParticipants();

                            assert.equal(lotteryState.toString(), "0");
                            assert(timeStamp > startingTimeStamp);
                            assert.equal(participants.toString(), "0");
                            assert.equal(Winner, accounts[0].address);
                            assert.equal(winnerFinalBalance.toString(), winnerInitialBalance.add(fees).toString());
                            console.table([winnerFinalBalance.toString(), winnerInitialBalance.toString()]);
                            resolve();
                        }
                        catch(err) {
                            reject(err);
                        }
                    });
                    
                    const response = await lottery.enterLottery({value: fees});
                    await response.wait(1);
                    winnerInitialBalance = await accounts[0].getBalance();
                });
            });
        });
    })