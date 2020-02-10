pragma solidity ^0.4.24;

import "../CronAggregator.sol";


contract MockCronAggregator is CronAggregator {

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
        CronAggregator(
            _currentValue,
            _fixedTimeBase,
            _fixedTimeFrequency,
            _contributionTimeWindow,
            _minContribution,
            _onlyUniqueContributors,
            _authorizedContributors
        )
    {

    }

    function getAggregation(uint256 _id)
        external
        view
        returns (uint256, uint256, uint256[], address[])
    {
        uint256 _minContribution = aggregation[_id].minContribution;
        uint256 _maxContribution = aggregation[_id].maxContribution;
        uint256[] storage _contributions = aggregation[_id].contributions;
        address[] storage _contributors = aggregation[_id].contributors;

        return (_minContribution,_maxContribution,_contributions,_contributors);
    }

    function getTimestamp()
        external
        view
        returns (uint256)
    {
        return block.timestamp;
    }
}
