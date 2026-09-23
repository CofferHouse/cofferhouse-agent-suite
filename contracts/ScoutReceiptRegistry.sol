// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ScoutReceiptRegistry
/// @notice Permissionless timestamp registry for CofferHouse Scout receipt hashes.
/// @dev An anchor proves publication by an address; it is not a CofferHouse endorsement.
contract ScoutReceiptRegistry {
    struct Anchor {
        address publisher;
        uint64 anchoredAt;
        bytes32 policyHash;
    }

    mapping(bytes32 contentHash => Anchor anchor) public anchors;

    event ReceiptAnchored(
        bytes32 indexed contentHash,
        bytes32 indexed policyHash,
        address indexed publisher,
        uint64 anchoredAt
    );

    error EmptyContentHash();
    error ReceiptAlreadyAnchored(bytes32 contentHash);

    function anchorReceipt(bytes32 contentHash, bytes32 policyHash) external {
        if (contentHash == bytes32(0)) revert EmptyContentHash();
        if (anchors[contentHash].publisher != address(0)) revert ReceiptAlreadyAnchored(contentHash);

        uint64 timestamp = uint64(block.timestamp);
        anchors[contentHash] = Anchor({ publisher: msg.sender, anchoredAt: timestamp, policyHash: policyHash });
        emit ReceiptAnchored(contentHash, policyHash, msg.sender, timestamp);
    }

    function isAnchored(bytes32 contentHash) external view returns (bool) {
        return anchors[contentHash].publisher != address(0);
    }
}
