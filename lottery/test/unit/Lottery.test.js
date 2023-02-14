const { namedNetworks, networkConfig } = require("../../helper-hardhat-config.js");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { assert, expect } = require("chai");

!namedNetworks.includes(network.name)
    ? describe.skip
    : describe("Lottery Testing Procedure Running", function() {
        let lottery;
        let vrfCoordinatorV2Mock;
        const chainId = network.config.chainId;
        let fees;
        let deployer;
        let interval;
        
        beforeEach(async function() {
            deployer = (await getNamedAccounts()).deployer;
            await deployments.fixture(["all"]);
            lottery = await ethers.getContract("Lottery", deployer);
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);

            fees = await lottery.getEntranceFees();
            interval = await lottery.getInterval();
        });
        
        describe("Constructor Tests", function() {
            it("correct constrctor initializations", async function() {
                const state = await lottery.getLotteryState();
                assert.equal(state.toString(), "0");
                assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            });
        });

        describe("Enter in Lottery", function() {
            it("Reverts if not receive required ETH for registration", async function() {
                await expect(lottery.enterLottery()).to.be.revertedWith("Lottery_NotEnoughETH");
            });

            it("Participant is added when they enter the Lottery", async function() {
                await lottery.enterLottery({value: fees});
                const participant = await lottery.getParticipant(0);
                assert.equal(participant, deployer);
            });

            it("Event is emitted when user enter", async function() {
                await expect(lottery.enterLottery({value: fees})).to.emit(lottery, "participantEntry");
            });

            it("Participation denied if Lottery is closed", async function() {
                await lottery.enterLottery({value: fees});

                // https://hardhat.org/hardhat-network/docs/reference#evm_increasetime
                // Special testing/debugging methods
                // evm_increaseTime will increase the time of the blockchain by interval.toNumber() + 1 seconds
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                // to mine an extra block
                await network.provider.send("evm_mine", []);
                await lottery.performUpkeep([]);
            });
        });

        describe("Checking Upkeep", function() {
            it("Returns false if time interval is not fulfilled", async function() {
                await lottery.enterLottery({value: fees});

                // here if we call a function with callStatic then it will not make a transaction on the blockchain
                // checkUpkeep is a transactional function, and while testing we don't want it to add a txn on blockchain
                const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                assert.equal(upkeepNeeded, false);
            });

            it("Returns false if there are no players", async function() {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);

                const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                assert.equal(upkeepNeeded, false);
            });

            it("Returns false if lottery is closed", async function() {
                await lottery.enterLottery({value: fees});
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);

                // this will set lottery state to calculating
                await lottery.performUpkeep("0x");

                const currState = await lottery.getLotteryState();

                const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                assert.equal(currState.toString(), "1");
                assert.equal(upkeepNeeded, false);
            });

            it("Returns true if everything of checkUpkeep is satisfied", async function() {
                await lottery.enterLottery({value: fees});

                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);

                const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                assert.equal(upkeepNeeded, true);
            });
        })

        describe("Test for Perform Upkeep", function() {
            it("Reverts if checkUpkeep returns false cuz of interval issues", async function() {
                await lottery.enterLottery({value: fees});
                
                // Reverts cuz time interval not fulfilled
                await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery_UpkeepNotNeeded");
            });

            it("Reverts if checkUpkeep returns false (no conditions)", async function() {
                // To be more specific with the revert error
                // We can mention the values by which we expect the function to be reverted
                // "Lottery_UpkeepNotNeeded(write the values which reverted along with the error as mentioned while declaring error)"
                await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery_UpkeepNotNeeded");
            });

            it("Runs only if checkUpkeep returns true", async function() {
                await lottery.enterLottery({value: fees});

                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);

                const txnResponse = await lottery.performUpkeep([]);
                assert(txnResponse);
            });

            it("Lottery State changes to Calculating", async function() {
                await lottery.enterLottery({value: fees});
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine");

                await lottery.performUpkeep([]);
                const currLotteryState = await lottery.getLotteryState();
                assert.equal(currLotteryState.toString(), "1");
            });

            it("Request Id is generated and event is emitted", async function() {
                await lottery.enterLottery({value: fees});
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine");
                
                const performUpkeepResponse = await lottery.performUpkeep([]);
                const receipt = await performUpkeepResponse.wait(1);
                const requestId = receipt.events[1].args.requestID;
                assert(requestId.toNumber() > 0);
                // await expect(lottery.performUpkeep([])).to.emit(lottery, "requestedLotteryWinner");
            })
        });

        describe("Fulfill Random Words Testing", async function() {
            beforeEach(async function() {
                await lottery.enterLottery({value: fees});
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
            });

            it("fulfillrandomWords will revert if performUpkeep not executed", async function() {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)).to.be.revertedWith("nonexistent request");
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(45, lottery.address)).to.be.revertedWith("nonexistent request");
            });

            it("Picks a Winner, resets the lottery, and sends money", async function() {
                const additionalAccounts = 6;
                const startingAcct = 1;
                const accounts = await ethers.getSigners();

                for (let i = startingAcct; i<startingAcct + additionalAccounts; i++) {
                    const externalAcct = lottery.connect(accounts[i]);
                    meow = await accounts[i].getBalance();
                    await externalAcct.enterLottery({value: fees});
                    // console.log(accounts[i].address);
                }
                

                await new Promise(async function(resolve, reject) {
                    lottery.once("WinnerSelected", async function() {
                        try {
                            const winner = await lottery.getRecentWinner();
                            const lotteryState = await lottery.getLotteryState();
                            const participants = await lottery.getNumberOfParticipants();
                            const latestTimeStamp = await lottery.getLastTimeStamp();
                            // console.log(`Winner- ${winner}`);

                            assert.equal(lotteryState.toString(), "0");
                            assert.equal(participants.toString(), "0");
                            assert(latestTimeStamp > prevTimeStamp);

                            let winnerAcctIdx;

                            for (let i = startingAcct; i<startingAcct + additionalAccounts; i++) {
                                if (accounts[i].address == winner) {
                                    winnerAcctIdx = i;
                                }
                            }
                            const finalWinnerBalance = await accounts[winnerAcctIdx].getBalance();
                            const finalContractBalance = await lottery.provider.getBalance(lottery.address);

                            // console.table([initialContractBalance.toString(), finalContractBalance.toString(), initialWinnerBalance.toString(), finalWinnerBalance.toString(), finalWinnerBalance.sub(initialWinnerBalance).toString()]);
                            assert.equal(finalWinnerBalance.toString(), initialWinnerBalance.add(initialContractBalance).toString());
                            // assert.equal(finalWinnerBalance.toString(), initialWinnerBalance.add(fees.mul(additionalAccounts + 1)).toString());

                            resolve();
                        }
                        catch(err) {
                            reject(err);
                        }
                    });

                    const response = await lottery.performUpkeep([]);
                    const receipt = await response.wait(1);

                    const reqId = receipt.events[1].args.requestID;
                    const prevTimeStamp = await lottery.getLastTimeStamp();

                    const initialWinnerBalance = await accounts[2].getBalance();
                    const initialContractBalance = await lottery.provider.getBalance(lottery.address);

                    await vrfCoordinatorV2Mock.fulfillRandomWords(reqId, lottery.address);
                });
            })
        });
    });