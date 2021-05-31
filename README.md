# Chainlink Cronjob aggregator contract

Allows to specify a recurring timewindow when multiple Oracles can feed in data points. These are then aggregated, resulting in the final value.

The contract is stateful, able to indicate the status of aggregation at all times, that can be queried on chain as well

# Status flags

- `DEFAULT` => default state when nothing has happened yet
- `OPEN_IDLE` => contribution window is open, awaiting feed
- `OPEN_ONGOING` => contribution window is open, aready received some feed
- `CLOSED_SUCCESS` => last contribution window is closed with successful aggregation
- `CLOSED_FAILIURE` => last contribution window is closed with unsuccessful aggregation

Additionally, if `isAggregated()` returns false, it means the value was set manually by the owner and not by aggregation.


# Cronjob aggregator contract constructor params

Specify your recurring time window:
- `uint256 _currentValue`: initial oracle value set manually
- `uint256 _fixedTimeBase`: the unix timestamp of a historical time when you want you timewindow to start. This date is used as a basis for time window calculation. E.g.: if you want make a timewindow that starts every day midnight, just give a timestamp of a historical midnight date.
- `uint256 _fixedTimeFrequency`: How often do you want the time window to start, in seconds. E.g. every hour => 3600
- `uint256 _contributionTimeWindow`: How long you want to have your time window to last in seconds
- `uint256 _minContribution`: How many contributors must contribute for the aggregation to be successful.
- `bool _onlyUniqueContributors`: Must each data point come from a unique contributor or not.
- `address[] memory _authorizedContributors`: List of authorized contributors.
