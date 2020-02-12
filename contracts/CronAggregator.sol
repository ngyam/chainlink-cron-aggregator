pragma solidity ^0.4.24;

import "chainlink/contracts/vendor/Ownable.sol";
import "chainlink/contracts/vendor/SafeMath.sol";


contract CronAggregator is Ownable {
    using SafeMath for uint256;

    enum AggregationStatus {
        DEFAULT,
        OPEN_IDLE,
        OPEN_ONGOING,
        CLOSED_SUCCESS,
        CLOSED_FAILIURE
    }

    struct Aggregation {
        uint256 minContribution;
        uint256 maxContribution;
        uint256[] contributions;
        address[] contributors;
    }

    uint256 public minContribution;
    uint256 public fixedTimeBase;
    uint256 public fixedTimeFrequency;
    uint256 public contributionTimeWindow;
    uint256 constant internal MAX_CONTRIBUTOR_COUNT = 45;

    uint256 public currentValue;
    uint256 public latestCompletedAggregation;
    uint256 public latestAggregationValue;
    uint256 public latestAggregationHeight;
    uint256 public latestAggregationTime;

    uint256 public aggregationCounter = 0;
    bytes32 internal aggregationSession;

    mapping(uint256 => Aggregation) internal aggregation;
    mapping(address => bool) public authorizedToContribute;

    address[] public authorizedContributors;

    bool public onlyUniqueContributors;

    event ContributionReceived(uint256 indexed response, uint256 indexed aggregationId, address indexed sender);
    event CurrentValueUpdated(uint256 indexed current, uint256 indexed aggregationId);

    constructor (
        uint256 _currentValue,
        uint256 _fixedTimeBase,
        uint256 _fixedTimeFrequency,
        uint256 _contributionTimeWindow,
        uint256 _minContribution,
        bool _onlyUniqueContributors,
        address[] _authorizedContributors
    )
        public
        onlyValidSettings(
            _fixedTimeBase,
            _fixedTimeFrequency,
            _contributionTimeWindow,
            _minContribution,
            _authorizedContributors
        )
    {
        currentValue = _currentValue;
        _updateTimeSettings(
            _fixedTimeBase,
            _fixedTimeFrequency,
            _contributionTimeWindow
        );
        _updateContributionSettings(
            _minContribution,
            _onlyUniqueContributors,
            _authorizedContributors
        );
    }

    function cronCallback(uint256 _value)
        external
        onlyContributionPeriod
        onlyAuthorizedContributor(msg.sender)
    {
        uint256 epoch = block.timestamp.sub(fixedTimeBase).div(fixedTimeFrequency);
        bytes32 assumedSession = keccak256(
            abi.encodePacked(
                epoch,
                fixedTimeBase,
                fixedTimeFrequency,
                aggregationCounter
            )
        );

        if (assumedSession != aggregationSession) {
            delete aggregation[aggregationCounter];
            aggregationCounter = aggregationCounter.add(1);
            aggregationSession = keccak256(
                abi.encodePacked(
                    epoch,
                    fixedTimeBase,
                    fixedTimeFrequency,
                    aggregationCounter
                )
            );
            aggregation[aggregationCounter].minContribution = minContribution;
            aggregation[aggregationCounter].maxContribution = authorizedContributors.length;
        } else {
            require(!_isFull(aggregationCounter), "Maximum contributions reached");
        }

        if(onlyUniqueContributors) {
            require(!_alreadyContributed(aggregationCounter), "Address already contributed");
            aggregation[aggregationCounter].contributors.push(msg.sender);    
        }

        aggregation[aggregationCounter].contributions.push(_value);
        emit ContributionReceived(_value, aggregationCounter, msg.sender);
        _updateLatestAnswer(aggregationCounter);
    }

    function setCurrentValue(uint256 _value)
        external
        onlyOwner
    {
        currentValue = _value;
    }

    function getStatus()
        public
        view
        returns(AggregationStatus)
    {
        uint256 epoch = block.timestamp.sub(fixedTimeBase).div(fixedTimeFrequency);
        bytes32 assumedSession = keccak256(
            abi.encodePacked(
                epoch,
                fixedTimeBase,
                fixedTimeFrequency,
                aggregationCounter
            )
        );
        
        if (isContributionPeriod()) {
            if (assumedSession == aggregationSession) {
                return AggregationStatus.OPEN_ONGOING;
            } else {
                return AggregationStatus.OPEN_IDLE;
            }
        } else {
            if (aggregationCounter == 0) {
                return AggregationStatus.DEFAULT;
            }
            if (assumedSession == aggregationSession) {
                if (latestCompletedAggregation == aggregationCounter) {
                    return AggregationStatus.CLOSED_SUCCESS;
                } else {
                    return AggregationStatus.CLOSED_FAILIURE;
                }
            } else {
                return AggregationStatus.CLOSED_FAILIURE;
            }
        }
    }

    function updateContributionSettings(
        uint256 _minContribution,
        bool _onlyUniqueContributors,
        address[] _authorizedContributors
    )
        public
        notContributionPeriod
        onlyOwner
        onlyValidSettings(
            fixedTimeBase,
            fixedTimeFrequency,
            contributionTimeWindow,
            _minContribution,
            _authorizedContributors
        )
    {
        for (uint8 i = 0; i < authorizedContributors.length; i++) {
            delete authorizedToContribute[authorizedContributors[i]];
        }
        delete authorizedContributors;

        _updateContributionSettings(
            _minContribution,
            _onlyUniqueContributors,
            _authorizedContributors
        );
    }

    function updateTimeSettings(
        uint256 _fixedTimeBase,
        uint256 _fixedTimeFrequency,
        uint256 _contributionTimeWindow
    )
        public
        notContributionPeriod
        onlyOwner
        onlyValidSettings(
            _fixedTimeBase,
            _fixedTimeFrequency,
            _contributionTimeWindow,
            minContribution,
            authorizedContributors
        )
    {
        _updateTimeSettings(
            _fixedTimeBase,
            _fixedTimeFrequency,
            _contributionTimeWindow
        );
    }

    function isAggregated()
        public
        view
        returns (bool)
    {
        return currentValue == latestAggregationValue;
    }

    function getAuthorizedContributors()
        public
        view
        returns (address[])
    {
        return authorizedContributors;
    }

    function isContributionPeriod()
        internal
        view
        returns (bool)
    {
        uint256 _rem = block.timestamp.sub(fixedTimeBase) % fixedTimeFrequency;
        return _rem <= contributionTimeWindow;
    }

    function _updateContributionSettings(
        uint256 _minContribution,
        bool _onlyUniqueContributors,
        address[] _authorizedContributors
    )
        internal
    {
        minContribution = _minContribution;
        onlyUniqueContributors = _onlyUniqueContributors;
        authorizedContributors = _authorizedContributors;

        for (uint8 i = 0; i < _authorizedContributors.length; i++) {
            authorizedToContribute[_authorizedContributors[i]] = true;
        }
    }

    function _updateTimeSettings(
        uint256 _fixedTimeBase,
        uint256 _fixedTimeFrequency,
        uint256 _contributionTimeWindow
    )
        internal
    {
        fixedTimeBase = _fixedTimeBase;
        fixedTimeFrequency = _fixedTimeFrequency;
        contributionTimeWindow = _contributionTimeWindow;
    }

    function _isFull(uint256 _aggregationId)
        internal
        view
        returns (bool)
    {
        return aggregation[_aggregationId].contributions.length >= aggregation[_aggregationId].maxContribution;
    }

    function _alreadyContributed(uint256 _aggregationId)
        private
        view
        returns (bool)
    {
        for(uint8 i = 0; i < aggregation[_aggregationId].contributors.length; i++) {
            if (aggregation[_aggregationId].contributors[i] == msg.sender) {
                return true;
            }
        }
        return false;
    }

    function _updateLatestAnswer(uint256 _aggregationId)
        private
        ensureMinContributionsReceived(_aggregationId)
        ensureOnlyLatestAnswer(_aggregationId)
    {
        uint256 responseLength = aggregation[_aggregationId].contributions.length;
        uint256 middleIndex = responseLength.div(2);
        if (responseLength % 2 == 0) {
            uint256 median1 = quickselect(aggregation[_aggregationId].contributions, middleIndex);
            uint256 median2 = quickselect(aggregation[_aggregationId].contributions, middleIndex.add(1)); // quickselect is 1 indexed
            currentValue = median1.add(median2) / 2; // signed integers are not supported by SafeMath
        } else {
            currentValue = quickselect(aggregation[_aggregationId].contributions, middleIndex.add(1)); // quickselect is 1 indexed
        }
        latestAggregationValue = currentValue;
        latestCompletedAggregation = _aggregationId;
        latestAggregationHeight = block.number;
        latestAggregationTime = block.timestamp;
        emit CurrentValueUpdated(currentValue, _aggregationId);
    }

    /**
    * @dev Prevents taking an action if the minimum number of contributions has not
    * been received for an answer.
    * @param _aggregationId The the identifier that keeps track of the contributions.
    */
    modifier ensureMinContributionsReceived(uint256 _aggregationId) {
        if (aggregation[_aggregationId].contributions.length >= aggregation[_aggregationId].minContribution) {
            _;
        }
    }

    modifier ensureOnlyLatestAnswer(uint256 _aggregationId) {
        if (latestCompletedAggregation <= _aggregationId) {
            _;
        }
    }

    modifier onlyAuthorizedContributor(address _address) {
        require(
            authorizedToContribute[_address],
            "Not an authorized address"
        );
        _;
    }

    modifier onlyContributionPeriod {
        require(isContributionPeriod(), "Not contribution period");
        _;
    }

    modifier notContributionPeriod {
        require(!isContributionPeriod(), "Contribution period");
        _;
    }

    modifier onlyValidSettings (
        uint256 _fixedTimeBase,
        uint256 _fixedTimeFrequency,
        uint256 _contributionTimeWindow,
        uint256 _minContribution,
        address[] _authorizedContributors
    ) {
        require(_authorizedContributors.length <= MAX_CONTRIBUTOR_COUNT, "Cannot have more than 45 contributors");
        require(_authorizedContributors.length >= _minContribution, "Must have at least as many contributors as required contributions");
        require(_fixedTimeBase <= block.timestamp, "Fixed-time base must be in the past");
        //require(_contributionTimeWindow > 0, "Contribution window cannot be 0");
        require(_fixedTimeFrequency > 0, "Time frequency cannot be 0");
        require(_fixedTimeFrequency > _contributionTimeWindow, "Freq must be > than window");
        _;
    }

    /**
    * @dev Returns the kth value of the ordered array
    * See: http://www.cs.yale.edu/homes/aspnes/pinewiki/QuickSelect.html
    * Taken from: https://github.com/smartcontractkit/chainlink/blob/develop/evm-contracts/src/v0.4/Aggregator.sol
    * @param _a The list of elements to pull from
    * @param _k The index, 1 based, of the elements you want to pull from when ordered
    */
    function quickselect(uint256[] memory _a, uint256 _k)
        private
        pure
        returns (uint256)
    {
        uint256[] memory a = _a;
        uint256 k = _k;
        uint256 aLen = a.length;
        uint256[] memory a1 = new uint256[](aLen);
        uint256[] memory a2 = new uint256[](aLen);
        uint256 a1Len;
        uint256 a2Len;
        uint256 pivot;
        uint256 i;

        while (true) {
            pivot = a[aLen.div(2)];
            a1Len = 0;
            a2Len = 0;
            for (i = 0; i < aLen; i++) {
                if (a[i] < pivot) {
                    a1[a1Len] = a[i];
                    a1Len++;
                } else if (a[i] > pivot) {
                    a2[a2Len] = a[i];
                    a2Len++;
                }
            }
            if (k <= a1Len) {
                aLen = a1Len;
                (a, a1) = swap(a, a1);
            } else if (k > (aLen.sub(a2Len))) {
                k = k.sub(aLen.sub(a2Len));
                aLen = a2Len;
                (a, a2) = swap(a, a2);
            } else {
                return pivot;
            }
        }
    }

    /**
    * @dev Swaps the pointers to two uint256 arrays in memory
    * @param _a The pointer to the first in memory array
    * @param _b The pointer to the second in memory array
    */
    function swap(uint256[] memory _a, uint256[] memory _b)
        private
        pure
        returns(uint256[] memory, uint256[] memory)
    {
        return (_b, _a);
    }
}
