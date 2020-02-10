
const CA = artifacts.require("CronAggregator");
// 1581296400 : 01:00:0
// 1581296100 : 00:55:0

module.exports = function(deployer) {
  console.log(process.argv)
  let isUnique = process.argv[10].toLowerCase() == true || process.argv[9] === "1"
  deployer.deploy(CA, process.argv[5], process.argv[6], process.argv[7], process.argv[8], process.argv[9], isUnique, process.argv[11].split(","));
};
