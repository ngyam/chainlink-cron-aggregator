const REVERT_ERROR_MSG = "VM Exception while processing transaction: revert"
const DEFAULT_ADDRESS = "0x0000000000000000000000000000000000000000"
const EMPTY_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000"

const AggregatorStatus = {
    DEFAULT: 0,
    OPEN_IDLE: 1,
    OPEN_ONGOING: 2,
    CLOSED_SUCCESS: 3,
    CLOSED_FAILIURE: 4
}

const send = (method, params = []) => {
    return new Promise((resolve, reject) => web3.currentProvider.send({id: 0, jsonrpc: '2.0', method, params }, (e, data) => {
        if (e) {
            reject(e)
        } else {
            resolve(data)
        }
    }))
}

const timeTravel = async seconds => {
    await send('evm_increaseTime', [seconds])
    await send('evm_mine')
}

const mineBlocks = async blocks => {
    for (let i = 0; i < blocks; i++) {
        await send('evm_mine')
    }
}

const createSnapshot = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: '2.0',
                method: 'evm_snapshot',
                params: [],
                id: 1
            },
            (e, r) => {
                if (e) reject(e)
                else {
                    resolve(r.result)
                }
            }
        )
    })
}

const revertSnapshot = (snapshotID, id) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: '2.0',
                method: "evm_revert",
                params: [snapshotID],
                id: id
            },
            (e, r) => {
                if (e) reject(e)
                else {
                    resolve(r.result)
                }
            }
        )
    })
}

async function assertThrowsAsync(fn, msg) {
    try {
        await fn()
    } catch (err) {
        assert(err.message.includes(msg), "Expected error to include: " + msg)
        return
    }
    assert.fail("Expected fn to throw")
}

module.exports = {
    send,
    revertSnapshot,
    createSnapshot,
    timeTravel,
    mineBlocks,
    assertThrowsAsync,
    REVERT_ERROR_MSG,
    DEFAULT_ADDRESS,
    EMPTY_BYTES32,
    AggregatorStatus
}