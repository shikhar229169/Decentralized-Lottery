// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "hardhat/console.sol";

error Lottery_NotEnoughETH();
error Lottery_TransactionFailed();
error Lottery_NotOpen();
error Lottery_UpkeepNotNeeded(uint256 balance, uint256 playersLength, uint256 lotteryState);



contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    enum LotteryState {
        OPEN,
        CALCULATING,
        CLOSED
    }

    uint256 immutable private i_fees;

    /** @dev making the addresses payable so that we can send ETH to the winner
    */
    address payable[] private s_participants; 

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;

    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionID;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;


    // Lottery Variables
    address private s_recentWinner;
    LotteryState private s_LotteryState;
    uint256 private s_LastTimestamp;
    uint256 private immutable i_interval;

    // Events
    event participantEntry(address indexed participant);
    event requestedLotteryWinner(uint256 indexed requestID);
    event WinnerSelected(address indexed winner);

    /** @dev VRFCoordinatorV2 is an address for the vrf coordinator to get the random words from vrf service by emitting event
    */
    constructor(address VRFCoordinatorV2, 
    uint256 entranceFees, 
    bytes32 gaseLane, 
    uint64 subscriptionID, 
    uint32 callbackGasLimit,
    uint256 interval) 
    VRFConsumerBaseV2(VRFCoordinatorV2) {
        i_fees = entranceFees;
        i_vrfCoordinator = VRFCoordinatorV2Interface(VRFCoordinatorV2);
        i_gasLane = gaseLane;
        i_subscriptionID = subscriptionID;
        i_callbackGasLimit = callbackGasLimit;
        s_LotteryState = LotteryState.OPEN;
        s_LastTimestamp = block.timestamp;
        i_interval = interval;
    }

    function enterLottery() public payable {
        if (msg.value < i_fees) {
            revert Lottery_NotEnoughETH();
        }
        if (s_LotteryState != LotteryState.OPEN) {
            revert Lottery_NotOpen();
        }
        s_participants.push(payable(msg.sender));
        emit participantEntry(msg.sender);
    }

    /**
     * @dev checkData helps us to do certain operations in our contract like calling a function and much more advance things we can store through callData
     * @dev This function will be called by chainlink nodes to check if their is a  need to call performUpKeed
     * 1. If upKeepNeeded is true then performUpkeep will run
     * 2. UpkeepNeeded will be true if
     * a) their are 2 players in lottery
     * b) The time interval is passed
     * c) their must be link to run the coordinator and get a random number to select the winner
     * d) the lottery must be in "open" state.
     * e) When the requestRandomWinner function will be invoked then the lottery should be changed to "closed" state so that no more participation occurs in that interval to select a random number and get the respective winner
    */
   function checkUpkeep(bytes memory /*checkData*/) public view override returns (bool upkeepNeeded, bytes memory /*performData*/) {
        bool isOpen = (s_LotteryState == LotteryState.OPEN);
        bool timePassed = (block.timestamp - s_LastTimestamp) > i_interval;
        bool hasPlayers = s_participants.length > 0;
        bool hasBalance = address(this).balance > 0;

        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
   }

    function performUpkeep(bytes calldata /*performData*/) external override {
        (bool upkeepNeeded, ) = checkUpkeep(""); 
        if (!upkeepNeeded) {
            revert Lottery_UpkeepNotNeeded(address(this).balance, s_participants.length, uint256(s_LotteryState));
        }
        s_LotteryState = LotteryState.CALCULATING;
                
        // requestRandomWords function of vrf Coordinator returns a requestId
        // This function will also emit an event conatining the request id and more arguments
        uint256 requestID = i_vrfCoordinator.requestRandomWords(
            i_gasLane,  // keyHash
            i_subscriptionID,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,   // limit on gas used by fullfillrandom words to retrieve the random words
            NUM_WORDS
        );

        emit requestedLotteryWinner(requestID);
    }

    // overriden from VRFConsumerBaseV2 in order to get the random words
    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override {
        uint256 indexOfWinner = randomWords[0] % s_participants.length;
        address payable recentWinner = s_participants[indexOfWinner];
        s_recentWinner = recentWinner;

        s_LotteryState = LotteryState.OPEN;
        s_participants = new address payable[](0);
        s_LastTimestamp = block.timestamp;

        (bool success, ) = recentWinner.call{value: address(this).balance}("");

        if (!success) {
            revert Lottery_TransactionFailed();
        }

        emit WinnerSelected(recentWinner);
    }

    function getEntranceFees() public view returns (uint256) {
        return i_fees;
    }

    function getParticipant(uint256 _idx) public view returns(address) {
        return s_participants[_idx];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_LotteryState;
    }

    /**
     * @dev as NUM_WORDS is constant and is not reading from storage as it is in bytecode, thus function is made pure 
    */
    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfParticipants() public view returns (uint256) {
        return s_participants.length;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_LastTimestamp;
    }


    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }


    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}