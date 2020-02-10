let CronAggregator = artifacts.require('MockCronAggregator.sol');
const BN = web3.utils.BN;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(web3.utils.BN))
    .should()

const {
    REVERT_ERROR_MSG,
    DEFAULT_ADDRESS,
    EMPTY_BYTES32,
    AggregatorStatus,
    mineBlocks,
    timeTravel
} = require(__dirname + "/../utils.js");

const ERROR_CONTR_MAXNUM = "Cannot have more than 45 contributors";
const ERROR_REQ_CONTRIBUTORS = "Must have at least as many contributors as required contributions";
const ERROR_TIMEB = "Fixed-time base must be in the past";
const ERROR_CWINDOW = "Contribution window cannot be 0";
const ERROR_TFREQ_0 = "Time frequency cannot be 0";
const ERROR_TFREQ_WINDOW = "Freq must be > than window";
const ERROR_MAX_REACHED = "Maximum contributions reached";
const ERROR_ALREADY_CTD = "Address already contributed";
const ERROR_NOT_CT_PERIOD = "Not contribution period";
const ERROR_CT_PERIOD = "Contribution period";
const ERROR_NOT_AUTH = "Not an authorized address";

let cronagg;

contract('CronAggregator', function (accounts) {

    let owner

    async function newAggregator(_owner, params) {
        owner = _owner
        cronagg = await CronAggregator.new(...params, { from: _owner }).should.be.fulfilled
    }

    beforeEach(async function () {
        await newAggregator(accounts[9], [1, 1000, 1000, 10, 3, true, accounts.slice(0,5)])
    })

    describe('constructor', async function () {

        beforeEach(async function () {
        })

        it('should initialize normally', async function () {
            await newAggregator(accounts[9], [1, 1000, 1000, 10, 3, true, accounts.slice(0,5)])
        })

        it('should allow initialization with min contribution = 0', async function () {
            await newAggregator(accounts[9], [1, 1000, 1000, 10, 0, true, accounts.slice(0,5)])
        })

        it('should not allow initialization with min contributors > contributors.', async function () {
            await newAggregator(accounts[9], [1, 1000, 1000, 10, 6, true, accounts.slice(0,5)]).should.be.rejectedWith(ERROR_REQ_CONTRIBUTORS)
        })

        it('should not allow more contributors than maximum ', async function () {
            await newAggregator(accounts[9], [1, 1000, 1000, 10, 3, true, accounts.concat(accounts, accounts, accounts, accounts)]).should.be.rejectedWith(ERROR_CONTR_MAXNUM)
        })

        it('should not allow time base to be in the future', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await newAggregator(accounts[9], [1, 10000000000000, 1000, 10, 3, true, accounts.slice(0,5)]).should.be.rejectedWith(ERROR_TIMEB);
            await newAggregator(accounts[9], [1, timestamp + 10, 1000, 10, 3, true, accounts.slice(0,5)]).should.be.rejectedWith(ERROR_TIMEB);
            await newAggregator(accounts[9], [1, timestamp + 5, 1000, 10, 3, true, accounts.slice(0,5)]).should.be.rejectedWith(ERROR_TIMEB);
        })

        it('should not allow frequency to be 0', async function () {
            await newAggregator(accounts[9], [1, 1000, 0, 10, 3, true, accounts.slice(0,5)]).should.be.rejectedWith(ERROR_TFREQ_0)
        })
        /*
        it('should not allow window to be 0', async function () {
            await newAggregator(accounts[9], [1, 1000, 1000, 0, 3, true, accounts.slice(0,5)]).should.be.rejectedWith(ERROR_CWINDOW);
        })
        */
        it('should not allow window > freq', async function () {
            await newAggregator(accounts[9], [1, 1000, 1000, 1001, 3, true, accounts.slice(0,5)]).should.be.rejectedWith(ERROR_TFREQ_WINDOW);
        })

        it('should set current value correctly', async function () {
            (await cronagg.currentValue.call()).should.be.bignumber.equal("1");
        })

        it('should set unique flag correctly', async function () {
            (await cronagg.onlyUniqueContributors.call()).should.be.true;
        })

        it('should set authorized contributors correctly', async function () {
            let check = accounts.slice(0,5);
            (await cronagg.getAuthorizedContributors.call()).should.be.deep.equal(check);
            for (let i = 0; i < check.length; i++) {
                (await cronagg.authorizedContributors(i)).should.be.equal(check[i]);
            }
        })
    })

    describe('setCurrentValue', async function () {

        it('should set correctly', async function () {
            await cronagg.setCurrentValue(5, {from: owner});
            (await cronagg.currentValue.call()).should.be.bignumber.equal("5");
        })
    })

    describe('isAggregated', async function () {

        it('should return false when manual', async function () {
            (await cronagg.isAggregated.call()).should.be.false;
        })

        it('should return true when aggregated', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            
            cronagg = await CronAggregator.new(1, timestamp, 86400, 600, 1, true, accounts.slice(0,1), { from: owner }).should.be.fulfilled;
            
            let values = [3];
            let x = accounts.slice(0, 1);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            (await cronagg.isAggregated.call()).should.be.true;
        })
    })

    describe('cronCallback', async function () {

        it('should perform correct aggregation on full contributors', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            
            cronagg = await CronAggregator.new(1, timestamp, 86400, 600, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            
            let values = [1,2,3,4,5];
            let x = accounts.slice(0, 5);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            (await cronagg.currentValue.call()).should.be.bignumber.equal("3");
            (await cronagg.latestAggregationValue.call()).should.be.bignumber.equal("3");
            (await cronagg.latestCompletedAggregation.call()).should.be.bignumber.equal("1");
            (await cronagg.aggregationCounter.call()).should.be.bignumber.equal("1");

            let aggregation = await cronagg.getAggregation(1);
            aggregation[0].should.be.bignumber.equal("3");
            aggregation[1].should.be.bignumber.equal("5");
            aggregation[2].map(x => x.toString()).should.be.deep.equal(values.map(x => x.toString()));
            aggregation[3].should.be.deep.equal(accounts.slice(0,5));
        })

        it('should perform aggregation correctly on 1 contributor', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            
            cronagg = await CronAggregator.new(1, timestamp, 86400, 600, 1, true, [accounts[0]], { from: owner }).should.be.fulfilled;

            await cronagg.cronCallback(6879, {from: accounts[0]}).should.be.fulfilled;

            (await cronagg.currentValue.call()).should.be.bignumber.equal("6879");
            (await cronagg.latestAggregationValue.call()).should.be.bignumber.equal("6879");
            (await cronagg.latestCompletedAggregation.call()).should.be.bignumber.equal("1");
            (await cronagg.aggregationCounter.call()).should.be.bignumber.equal("1");
        })

        it('should perform aggregation correctly on 2 contributors', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            
            cronagg = await CronAggregator.new(1, timestamp, 86400, 600, 2, true, accounts.slice(0, 2), { from: owner }).should.be.fulfilled;
            
            let values = [6879, 9];
            let x = accounts.slice(0, 2);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }

            (await cronagg.currentValue.call()).should.be.bignumber.equal("3444");
            (await cronagg.latestAggregationValue.call()).should.be.bignumber.equal("3444");
            (await cronagg.latestCompletedAggregation.call()).should.be.bignumber.equal("1");
            (await cronagg.aggregationCounter.call()).should.be.bignumber.equal("1");
        })

        it('should perform correct aggregation on min contributors', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await timeTravel(10);

            cronagg = await CronAggregator.new(1, timestamp + 10, 86400, 600, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;

            let values = [1,2,3];
            let x = accounts.slice(0, 3);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            (await cronagg.currentValue.call()).should.be.bignumber.equal("2");
            (await cronagg.latestAggregationValue.call()).should.be.bignumber.equal("2");
            (await cronagg.latestCompletedAggregation.call()).should.be.bignumber.equal("1");
            (await cronagg.aggregationCounter.call()).should.be.bignumber.equal("1");

            let aggregation = await cronagg.getAggregation(1);
            aggregation[0].should.be.bignumber.equal("3");
            aggregation[1].should.be.bignumber.equal("5");
            aggregation[2].map(x => x.toString()).should.be.deep.equal(values.map(x => x.toString()));
            aggregation[3].should.be.deep.equal(accounts.slice(0,3));
        })

        it('should perform correct aggregation on min contributors', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await timeTravel(10);
            
            cronagg = await CronAggregator.new(1, timestamp + 10, 86400, 600, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            
            let values = [1,2,3];
            let x = accounts.slice(0, 3);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            (await cronagg.currentValue.call()).should.be.bignumber.equal("2");
            (await cronagg.latestAggregationValue.call()).should.be.bignumber.equal("2");
            (await cronagg.latestCompletedAggregation.call()).should.be.bignumber.equal("1");
            (await cronagg.aggregationCounter.call()).should.be.bignumber.equal("1");

            let aggregation = await cronagg.getAggregation(1);
            aggregation[0].should.be.bignumber.equal("3");
            aggregation[1].should.be.bignumber.equal("5");
            aggregation[2].map(x => x.toString()).should.be.deep.equal(values.map(x => x.toString()));
            aggregation[3].should.be.deep.equal(accounts.slice(0,3));
        })

        it('should reject if all contributed and onlyUnique is on', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await timeTravel(10);
            
            cronagg = await CronAggregator.new(1, timestamp + 10, 86400, 600, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            
            let values = [1,2,3,4,5];
            let x = accounts.slice(0, 5);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.rejectedWith(ERROR_MAX_REACHED);
            }
        })

        it('should reject if all contributed and onlyUnique is off', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await timeTravel(10);
            
            cronagg = await CronAggregator.new(1, timestamp + 10, 86400, 600, 3, false, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            
            let values = [1,2,3,4,5];
            let x = accounts.slice(0, 5);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.rejectedWith(ERROR_MAX_REACHED);
            }
        })

        it('should reject if non contributor and onlyUnique is off', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await timeTravel(10);
            
            cronagg = await CronAggregator.new(1, timestamp + 10, 86400, 600, 3, false, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            
            let values = [1,2,3,4,5];
            let x = accounts.slice(5, 9);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.rejectedWith(ERROR_NOT_AUTH);
            }
        })

        it('should reject if non contributor and onlyUnique is on', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await timeTravel(10);
            
            cronagg = await CronAggregator.new(1, timestamp + 10, 86400, 600, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            
            let values = [1,2,3,4,5];
            let x = accounts.slice(5, 9);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.rejectedWith(ERROR_NOT_AUTH);
            }
        })

        it('should reject in non-contribution period', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            cronagg = await CronAggregator.new(1, timestamp-10, 86400, 5, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;

            let values = [1,2,3,4,5];
            let x = accounts.slice(0, 5);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.rejectedWith(ERROR_NOT_CT_PERIOD);
            }
        })

        it('should reject if already contributed and onlyUnique is on', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            cronagg = await CronAggregator.new(1, timestamp, 86400, 1000, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;

            let values = [1,2,3];
            let x = accounts.slice(0, 3);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.rejectedWith(ERROR_ALREADY_CTD);
            }
        })
    })

    describe('getStatus', async function () {

        it('should return DEFAULT when deployed', async function () {
            (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.DEFAULT.toString());
        })

        it('should return correctly when IDLE aggregation period', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            cronagg = await CronAggregator.new(1, timestamp, 86400, 1000, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;

            (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.OPEN_IDLE.toString());
            await timeTravel(86400 + timestamp - (await cronagg.getTimestamp.call()).toNumber());

            (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.OPEN_IDLE.toString());
        })

        it('should return correctly when ONGOING aggregation period', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            cronagg = await CronAggregator.new(1, timestamp, 86400, 1000, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            let values = [5,4,3,2,1];
            let x = accounts.slice(0, 3);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
                (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.OPEN_ONGOING.toString());
            }

            await timeTravel(86400 + timestamp - (await cronagg.getTimestamp.call()).toNumber());

            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
                (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.OPEN_ONGOING.toString());
            }

        })

        it('should return correctly when not aggregation period and SUCCESSFUL', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            cronagg = await CronAggregator.new(1, timestamp, 86400, 1000, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            let values = [1,2,3,4,5];
            let x = accounts.slice(0, 5);
            for (let i = 0; i < x.length; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            await timeTravel(1001);
            (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.CLOSED_SUCCESS.toString());

            let newtimestamp = (await cronagg.getTimestamp.call()).toNumber();
            await timeTravel(86400 - ((newtimestamp - timestamp) % 86400));

            for (let i = 0; i < 3; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            await timeTravel(1001);
            (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.CLOSED_SUCCESS.toString());
        })

        it('should return correctly when not aggregation period and FAILED', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            cronagg = await CronAggregator.new(1, timestamp, 86400, 1000, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            let values = [1,2,3,4,5];
            let x = accounts.slice(0, 5);
            for (let i = 0; i < 2; i++) {
                await cronagg.cronCallback(values[i], {from: x[i]}).should.be.fulfilled;
            }
            await timeTravel(1001);
            (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.CLOSED_FAILIURE.toString());

            let newtimestamp = (await cronagg.getTimestamp.call()).toNumber();
            await timeTravel(86400 - ((newtimestamp - timestamp) % 86400));
            await timeTravel(1001);
            (await cronagg.getStatus()).should.be.bignumber.equal(AggregatorStatus.CLOSED_FAILIURE.toString());
        })
    })

    describe('updateContributionSettings', async function () {

        it('should not allow min to be larger than num contr', async function () {
            await cronagg.updateContributionSettings(3, true, accounts.slice(0,2), {from: owner}).should.be.rejectedWith(ERROR_REQ_CONTRIBUTORS);
        })

        it('should allow min == num contr', async function () {
            await cronagg.updateContributionSettings(2, true, accounts.slice(0,2), {from: owner}).should.be.fulfilled;
        })

        it('should allow min to be 0', async function () {
            await cronagg.updateContributionSettings(0, true, accounts.slice(0,2), {from: owner}).should.be.fulfilled;
        })

        it('should allow contributors to be empty list', async function () {
            await cronagg.updateContributionSettings(0, true, [], {from: owner}).should.be.fulfilled;
        })

        it('should allow only owner to update', async function () {
            await cronagg.updateContributionSettings(1, true, accounts.slice(0,2), {from: accounts[5]}).should.be.rejected;
            await cronagg.updateContributionSettings(1, true, accounts.slice(0,2), {from: accounts[0]}).should.be.rejected;
            await cronagg.updateContributionSettings(1, true, accounts.slice(0,2), {from: owner}).should.be.fulfilled;
        })

        it('should not allow in contribution period', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            cronagg = await CronAggregator.new(1, timestamp-10, 86400, 30, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            await cronagg.updateContributionSettings(1, true, accounts.slice(0,2), {from: owner}).should.be.rejectedWith(ERROR_CT_PERIOD);
        })
    })

    describe('updateTimeSettings', async function () {

        it('should not allow timebase to be in future', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await cronagg.updateTimeSettings(10000000000, 1000, 10, {from: owner}).should.be.rejectedWith(ERROR_TIMEB);
            await cronagg.updateTimeSettings(timestamp + 5, 1000, 10, {from: owner}).should.be.rejectedWith(ERROR_TIMEB);
            await cronagg.updateTimeSettings(timestamp + 10, 1000, 10, {from: owner}).should.be.rejectedWith(ERROR_TIMEB);
        })

        it('should not allow time freq to be 0', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await cronagg.updateTimeSettings(1000, 0, 10, {from: owner}).should.be.rejectedWith(ERROR_TFREQ_0);
        })

        it('should not allow time < window', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await cronagg.updateTimeSettings(1000, 10, 10, {from: owner}).should.be.rejectedWith(ERROR_TFREQ_WINDOW);
        })

        it('should allow window 0', async function () {
            await cronagg.updateTimeSettings(1000, 100, 0, {from: owner}).should.be.fulfilled;
        })

        it('should allow only owner to update', async function () {
            await cronagg.updateTimeSettings(1000, 1000, 10, {from: accounts[5]}).should.be.rejected;
            await cronagg.updateTimeSettings(1000, 1000, 10, {from: accounts[0]}).should.be.rejected;
            await cronagg.updateTimeSettings(1000, 1000, 10, {from: owner}).should.be.fulfilled;
        })

        it('should not allow in contribution period', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            cronagg = await CronAggregator.new(1, timestamp-10, 86400, 30, 3, true, accounts.slice(0,5), { from: owner }).should.be.fulfilled;
            await cronagg.updateTimeSettings(1000, 1000, 10, {from: owner}).should.be.rejectedWith(ERROR_CT_PERIOD);
        })
    })

    describe('getAuthorizedContributors', async function () {

        it('should return correctly', async function () {
            let timestamp = (await cronagg.getTimestamp.call()).toNumber();
            await newAggregator(owner, [1, timestamp-10001, 86400, 100, 3, true, accounts.slice(0,5)]);
            (await cronagg.getAuthorizedContributors.call()).should.be.deep.equal(accounts.slice(0, 5));
            await cronagg.updateContributionSettings(2, true, accounts.slice(0,2), {from: owner}).should.be.fulfilled;
            (await cronagg.getAuthorizedContributors.call()).should.be.deep.equal(accounts.slice(0, 2));
        })
    })
})