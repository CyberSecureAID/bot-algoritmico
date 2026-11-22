// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// ===== node_modules/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol =====
// OpenZeppelin Contracts (last updated v4.9.0) (utils/Address.sol)

/**
 * @dev Collection of functions related to the address type
 */
library AddressUpgradeable {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     *
     * Furthermore, `isContract` will also return true if the target contract within
     * the same transaction is already scheduled for destruction by `SELFDESTRUCT`,
     * which only has an effect at the end of a transaction.
     * ====
     *
     * [IMPORTANT]
     * ====
     * You shouldn't rely on `isContract` to protect against flash loan attacks!
     *
     * Preventing calls from contracts is highly discouraged. It breaks composability, breaks support for smart wallets
     * like Gnosis Safe, and does not provide security since it can be circumvented by calling from a contract
     * constructor.
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize/address.code.length, which returns 0
        // for contracts in construction, since the code is only stored at the end
        // of the constructor execution.

        return account.code.length > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.0/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and revert (either by bubbling
     * the revert reason or using the provided one) in case of unsuccessful call or if target was not a contract.
     *
     * _Available since v4.8._
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        if (success) {
            if (returndata.length == 0) {
                // only check isContract if the call was successful and the return data is empty
                // otherwise we already know that it was a contract
                require(isContract(target), "Address: call to non-contract");
            }
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and revert if it wasn't, either by bubbling the
     * revert reason or using the provided one.
     *
     * _Available since v4.3._
     */
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function _revert(bytes memory returndata, string memory errorMessage) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert(errorMessage);
        }
    }
}


// ===== node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol =====
// OpenZeppelin Contracts (last updated v4.9.0) (proxy/utils/Initializable.sol)



/**
 * @dev This is a base contract to aid in writing upgradeable contracts, or any kind of contract that will be deployed
 * behind a proxy. Since proxied contracts do not make use of a constructor, it's common to move constructor logic to an
 * external initializer function, usually called `initialize`. It then becomes necessary to protect this initializer
 * function so it can only be called once. The {initializer} modifier provided by this contract will have this effect.
 *
 * The initialization functions use a version number. Once a version number is used, it is consumed and cannot be
 * reused. This mechanism prevents re-execution of each "step" but allows the creation of new initialization steps in
 * case an upgrade adds a module that needs to be initialized.
 *
 * For example:
 *
 * [.hljs-theme-light.nopadding]
 * ```solidity
 * contract MyToken is ERC20Upgradeable {
 *     function initialize() initializer public {
 *         __ERC20_init("MyToken", "MTK");
 *     }
 * }
 *
 * contract MyTokenV2 is MyToken, ERC20PermitUpgradeable {
 *     function initializeV2() reinitializer(2) public {
 *         __ERC20Permit_init("MyToken");
 *     }
 * }
 * ```
 *
 * TIP: To avoid leaving the proxy in an uninitialized state, the initializer function should be called as early as
 * possible by providing the encoded function call as the `_data` argument to {ERC1967Proxy-constructor}.
 *
 * CAUTION: When used with inheritance, manual care must be taken to not invoke a parent initializer twice, or to ensure
 * that all initializers are idempotent. This is not verified automatically as constructors are by Solidity.
 *
 * [CAUTION]
 * ====
 * Avoid leaving a contract uninitialized.
 *
 * An uninitialized contract can be taken over by an attacker. This applies to both a proxy and its implementation
 * contract, which may impact the proxy. To prevent the implementation contract from being used, you should invoke
 * the {_disableInitializers} function in the constructor to automatically lock it when it is deployed:
 *
 * [.hljs-theme-light.nopadding]
 * ```
 * /// @custom:oz-upgrades-unsafe-allow constructor
 * constructor() {
 *     _disableInitializers();
 * }
 * ```
 * ====
 */
abstract contract Initializable {
    /**
     * @dev Indicates that the contract has been initialized.
     * @custom:oz-retyped-from bool
     */
    uint8 private _initialized;

    /**
     * @dev Indicates that the contract is in the process of being initialized.
     */
    bool private _initializing;

    /**
     * @dev Triggered when the contract has been initialized or reinitialized.
     */
    event Initialized(uint8 version);

    /**
     * @dev A modifier that defines a protected initializer function that can be invoked at most once. In its scope,
     * `onlyInitializing` functions can be used to initialize parent contracts.
     *
     * Similar to `reinitializer(1)`, except that functions marked with `initializer` can be nested in the context of a
     * constructor.
     *
     * Emits an {Initialized} event.
     */
    modifier initializer() {
        bool isTopLevelCall = !_initializing;
        require(
            (isTopLevelCall && _initialized < 1) || (!AddressUpgradeable.isContract(address(this)) && _initialized == 1),
            "Initializable: contract is already initialized"
        );
        _initialized = 1;
        if (isTopLevelCall) {
            _initializing = true;
        }
        _;
        if (isTopLevelCall) {
            _initializing = false;
            emit Initialized(1);
        }
    }

    /**
     * @dev A modifier that defines a protected reinitializer function that can be invoked at most once, and only if the
     * contract hasn't been initialized to a greater version before. In its scope, `onlyInitializing` functions can be
     * used to initialize parent contracts.
     *
     * A reinitializer may be used after the original initialization step. This is essential to configure modules that
     * are added through upgrades and that require initialization.
     *
     * When `version` is 1, this modifier is similar to `initializer`, except that functions marked with `reinitializer`
     * cannot be nested. If one is invoked in the context of another, execution will revert.
     *
     * Note that versions can jump in increments greater than 1; this implies that if multiple reinitializers coexist in
     * a contract, executing them in the right order is up to the developer or operator.
     *
     * WARNING: setting the version to 255 will prevent any future reinitialization.
     *
     * Emits an {Initialized} event.
     */
    modifier reinitializer(uint8 version) {
        require(!_initializing && _initialized < version, "Initializable: contract is already initialized");
        _initialized = version;
        _initializing = true;
        _;
        _initializing = false;
        emit Initialized(version);
    }

    /**
     * @dev Modifier to protect an initialization function so that it can only be invoked by functions with the
     * {initializer} and {reinitializer} modifiers, directly or indirectly.
     */
    modifier onlyInitializing() {
        require(_initializing, "Initializable: contract is not initializing");
        _;
    }

    /**
     * @dev Locks the contract, preventing any future reinitialization. This cannot be part of an initializer call.
     * Calling this in the constructor of a contract will prevent that contract from being initialized or reinitialized
     * to any version. It is recommended to use this to lock implementation contracts that are designed to be called
     * through proxies.
     *
     * Emits an {Initialized} event the first time it is successfully executed.
     */
    function _disableInitializers() internal virtual {
        require(!_initializing, "Initializable: contract is initializing");
        if (_initialized != type(uint8).max) {
            _initialized = type(uint8).max;
            emit Initialized(type(uint8).max);
        }
    }

    /**
     * @dev Returns the highest version that has been initialized. See {reinitializer}.
     */
    function _getInitializedVersion() internal view returns (uint8) {
        return _initialized;
    }

    /**
     * @dev Returns `true` if the contract is currently initializing. See {onlyInitializing}.
     */
    function _isInitializing() internal view returns (bool) {
        return _initializing;
    }
}


// ===== node_modules/@openzeppelin/contracts-upgradeable/interfaces/draft-IERC1822Upgradeable.sol =====
// OpenZeppelin Contracts (last updated v4.5.0) (interfaces/draft-IERC1822.sol)

/**
 * @dev ERC1822: Universal Upgradeable Proxy Standard (UUPS) documents a method for upgradeability through a simplified
 * proxy whose upgrades are fully controlled by the current implementation.
 */
interface IERC1822ProxiableUpgradeable {
    /**
     * @dev Returns the storage slot that the proxiable contract assumes is being used to store the implementation
     * address.
     *
     * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
     * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
     * function revert if invoked through a proxy.
     */
    function proxiableUUID() external view returns (bytes32);
}


// ===== node_modules/@openzeppelin/contracts-upgradeable/proxy/beacon/IBeaconUpgradeable.sol =====
// OpenZeppelin Contracts v4.4.1 (proxy/beacon/IBeacon.sol)

/**
 * @dev This is the interface that {BeaconProxy} expects of its beacon.
 */
interface IBeaconUpgradeable {
    /**
     * @dev Must return an address that can be used as a delegate call target.
     *
     * {BeaconProxy} will check that this address is a contract.
     */
    function implementation() external view returns (address);
}


// ===== node_modules/@openzeppelin/contracts-upgradeable/interfaces/IERC1967Upgradeable.sol =====
// OpenZeppelin Contracts (last updated v4.9.0) (interfaces/IERC1967.sol)

/**
 * @dev ERC-1967: Proxy Storage Slots. This interface contains the events defined in the ERC.
 *
 * _Available since v4.8.3._
 */
interface IERC1967Upgradeable {
    /**
     * @dev Emitted when the implementation is upgraded.
     */
    event Upgraded(address indexed implementation);

    /**
     * @dev Emitted when the admin account has changed.
     */
    event AdminChanged(address previousAdmin, address newAdmin);

    /**
     * @dev Emitted when the beacon is changed.
     */
    event BeaconUpgraded(address indexed beacon);
}


// ===== node_modules/@openzeppelin/contracts-upgradeable/utils/StorageSlotUpgradeable.sol =====
// OpenZeppelin Contracts (last updated v4.9.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(Address.isContract(newImplementation), "ERC1967: new implementation is not a contract");
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * _Available since v4.1 for `address`, `bool`, `bytes32`, `uint256`._
 * _Available since v4.9 for `string`, `bytes`._
 */
library StorageSlotUpgradeable {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := store.slot
        }
    }
}


// ===== node_modules/@openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol =====
// OpenZeppelin Contracts (last updated v4.9.0) (proxy/ERC1967/ERC1967Upgrade.sol)








/**
 * @dev This abstract contract provides getters and event emitting update functions for
 * https://eips.ethereum.org/EIPS/eip-1967[EIP1967] slots.
 *
 * _Available since v4.1._
 */
abstract contract ERC1967UpgradeUpgradeable is Initializable, IERC1967Upgradeable {
    // This is the keccak-256 hash of "eip1967.proxy.rollback" subtracted by 1
    bytes32 private constant _ROLLBACK_SLOT = 0x4910fdfa16fed3260ed0e7147f7cc6da11a60208b5b9406d12a635614ffd9143;

    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function __ERC1967Upgrade_init() internal onlyInitializing {
    }

    function __ERC1967Upgrade_init_unchained() internal onlyInitializing {
    }
    /**
     * @dev Returns the current implementation address.
     */
    function _getImplementation() internal view returns (address) {
        return StorageSlotUpgradeable.getAddressSlot(_IMPLEMENTATION_SLOT).value;
    }

    /**
     * @dev Stores a new address in the EIP1967 implementation slot.
     */
    function _setImplementation(address newImplementation) private {
        require(AddressUpgradeable.isContract(newImplementation), "ERC1967: new implementation is not a contract");
        StorageSlotUpgradeable.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
    }

    /**
     * @dev Perform implementation upgrade
     *
     * Emits an {Upgraded} event.
     */
    function _upgradeTo(address newImplementation) internal {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    /**
     * @dev Perform implementation upgrade with additional setup call.
     *
     * Emits an {Upgraded} event.
     */
    function _upgradeToAndCall(address newImplementation, bytes memory data, bool forceCall) internal {
        _upgradeTo(newImplementation);
        if (data.length > 0 || forceCall) {
            AddressUpgradeable.functionDelegateCall(newImplementation, data);
        }
    }

    /**
     * @dev Perform implementation upgrade with security checks for UUPS proxies, and additional setup call.
     *
     * Emits an {Upgraded} event.
     */
    function _upgradeToAndCallUUPS(address newImplementation, bytes memory data, bool forceCall) internal {
        // Upgrades from old implementations will perform a rollback test. This test requires the new
        // implementation to upgrade back to the old, non-ERC1822 compliant, implementation. Removing
        // this special case will break upgrade paths from old UUPS implementation to new ones.
        if (StorageSlotUpgradeable.getBooleanSlot(_ROLLBACK_SLOT).value) {
            _setImplementation(newImplementation);
        } else {
            try IERC1822ProxiableUpgradeable(newImplementation).proxiableUUID() returns (bytes32 slot) {
                require(slot == _IMPLEMENTATION_SLOT, "ERC1967Upgrade: unsupported proxiableUUID");
            } catch {
                revert("ERC1967Upgrade: new implementation is not UUPS");
            }
            _upgradeToAndCall(newImplementation, data, forceCall);
        }
    }

    /**
     * @dev Storage slot with the admin of the contract.
     * This is the keccak-256 hash of "eip1967.proxy.admin" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 internal constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /**
     * @dev Returns the current admin.
     */
    function _getAdmin() internal view returns (address) {
        return StorageSlotUpgradeable.getAddressSlot(_ADMIN_SLOT).value;
    }

    /**
     * @dev Stores a new address in the EIP1967 admin slot.
     */
    function _setAdmin(address newAdmin) private {
        require(newAdmin != address(0), "ERC1967: new admin is the zero address");
        StorageSlotUpgradeable.getAddressSlot(_ADMIN_SLOT).value = newAdmin;
    }

    /**
     * @dev Changes the admin of the proxy.
     *
     * Emits an {AdminChanged} event.
     */
    function _changeAdmin(address newAdmin) internal {
        emit AdminChanged(_getAdmin(), newAdmin);
        _setAdmin(newAdmin);
    }

    /**
     * @dev The storage slot of the UpgradeableBeacon contract which defines the implementation for this proxy.
     * This is bytes32(uint256(keccak256('eip1967.proxy.beacon')) - 1)) and is validated in the constructor.
     */
    bytes32 internal constant _BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    /**
     * @dev Returns the current beacon.
     */
    function _getBeacon() internal view returns (address) {
        return StorageSlotUpgradeable.getAddressSlot(_BEACON_SLOT).value;
    }

    /**
     * @dev Stores a new beacon in the EIP1967 beacon slot.
     */
    function _setBeacon(address newBeacon) private {
        require(AddressUpgradeable.isContract(newBeacon), "ERC1967: new beacon is not a contract");
        require(
            AddressUpgradeable.isContract(IBeaconUpgradeable(newBeacon).implementation()),
            "ERC1967: beacon implementation is not a contract"
        );
        StorageSlotUpgradeable.getAddressSlot(_BEACON_SLOT).value = newBeacon;
    }

    /**
     * @dev Perform beacon upgrade with additional setup call. Note: This upgrades the address of the beacon, it does
     * not upgrade the implementation contained in the beacon (see {UpgradeableBeacon-_setImplementation} for that).
     *
     * Emits a {BeaconUpgraded} event.
     */
    function _upgradeBeaconToAndCall(address newBeacon, bytes memory data, bool forceCall) internal {
        _setBeacon(newBeacon);
        emit BeaconUpgraded(newBeacon);
        if (data.length > 0 || forceCall) {
            AddressUpgradeable.functionDelegateCall(IBeaconUpgradeable(newBeacon).implementation(), data);
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}


// ===== node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol =====
// OpenZeppelin Contracts (last updated v4.9.0) (proxy/utils/UUPSUpgradeable.sol)





/**
 * @dev An upgradeability mechanism designed for UUPS proxies. The functions included here can perform an upgrade of an
 * {ERC1967Proxy}, when this contract is set as the implementation behind such a proxy.
 *
 * A security mechanism ensures that an upgrade does not turn off upgradeability accidentally, although this risk is
 * reinstated if the upgrade retains upgradeability but removes the security mechanism, e.g. by replacing
 * `UUPSUpgradeable` with a custom implementation of upgrades.
 *
 * The {_authorizeUpgrade} function must be overridden to include access restriction to the upgrade mechanism.
 *
 * _Available since v4.1._
 */
abstract contract UUPSUpgradeable is Initializable, IERC1822ProxiableUpgradeable, ERC1967UpgradeUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable state-variable-assignment
    address private immutable __self = address(this);

    /**
     * @dev Check that the execution is being performed through a delegatecall call and that the execution context is
     * a proxy contract with an implementation (as defined in ERC1967) pointing to self. This should only be the case
     * for UUPS and transparent proxies that are using the current contract as their implementation. Execution of a
     * function through ERC1167 minimal proxies (clones) would not normally pass this test, but is not guaranteed to
     * fail.
     */
    modifier onlyProxy() {
        require(address(this) != __self, "Function must be called through delegatecall");
        require(_getImplementation() == __self, "Function must be called through active proxy");
        _;
    }

    /**
     * @dev Check that the execution is not being performed through a delegate call. This allows a function to be
     * callable on the implementing contract but not through proxies.
     */
    modifier notDelegated() {
        require(address(this) == __self, "UUPSUpgradeable: must not be called through delegatecall");
        _;
    }

    function __UUPSUpgradeable_init() internal onlyInitializing {
    }

    function __UUPSUpgradeable_init_unchained() internal onlyInitializing {
    }
    /**
     * @dev Implementation of the ERC1822 {proxiableUUID} function. This returns the storage slot used by the
     * implementation. It is used to validate the implementation's compatibility when performing an upgrade.
     *
     * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
     * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
     * function revert if invoked through a proxy. This is guaranteed by the `notDelegated` modifier.
     */
    function proxiableUUID() external view virtual override notDelegated returns (bytes32) {
        return _IMPLEMENTATION_SLOT;
    }

    /**
     * @dev Upgrade the implementation of the proxy to `newImplementation`.
     *
     * Calls {_authorizeUpgrade}.
     *
     * Emits an {Upgraded} event.
     *
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeTo(address newImplementation) public virtual onlyProxy {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, new bytes(0), false);
    }

    /**
     * @dev Upgrade the implementation of the proxy to `newImplementation`, and subsequently execute the function call
     * encoded in `data`.
     *
     * Calls {_authorizeUpgrade}.
     *
     * Emits an {Upgraded} event.
     *
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) public payable virtual onlyProxy {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, data, true);
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     *
     * Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.
     *
     * ```solidity
     * function _authorizeUpgrade(address) internal override onlyOwner {}
     * ```
     */
    function _authorizeUpgrade(address newImplementation) internal virtual;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}


// ===== node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol =====
// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}


// ===== node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol =====
// OpenZeppelin Contracts (last updated v4.9.4) (token/ERC20/extensions/IERC20Permit.sol)

/**
 * @dev Interface of the ERC20 Permit extension allowing approvals to be made via signatures, as defined in
 * https://eips.ethereum.org/EIPS/eip-2612[EIP-2612].
 *
 * Adds the {permit} method, which can be used to change an account's ERC20 allowance (see {IERC20-allowance}) by
 * presenting a message signed by the account. By not relying on {IERC20-approve}, the token holder account doesn't
 * need to send a transaction, and thus is not required to hold Ether at all.
 *
 * ==== Security Considerations
 *
 * There are two important considerations concerning the use of `permit`. The first is that a valid permit signature
 * expresses an allowance, and it should not be assumed to convey additional meaning. In particular, it should not be
 * considered as an intention to spend the allowance in any specific way. The second is that because permits have
 * built-in replay protection and can be submitted by anyone, they can be frontrun. A protocol that uses permits should
 * take this into consideration and allow a `permit` call to fail. Combining these two aspects, a pattern that may be
 * generally recommended is:
 *
 * ```solidity
 * function doThingWithPermit(..., uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public {
 *     try token.permit(msg.sender, address(this), value, deadline, v, r, s) {} catch {}
 *     doThing(..., value);
 * }
 *
 * function doThing(..., uint256 value) public {
 *     token.safeTransferFrom(msg.sender, address(this), value);
 *     ...
 * }
 * ```
 *
 * Observe that: 1) `msg.sender` is used as the owner, leaving no ambiguity as to the signer intent, and 2) the use of
 * `try/catch` allows the permit to fail and makes the code tolerant to frontrunning. (See also
 * {SafeERC20-safeTransferFrom}).
 *
 * Additionally, note that smart contract wallets (such as Argent or Safe) are not able to produce permit signatures, so
 * contracts should have entry points that don't rely on permit.
 */
interface IERC20Permit {
    /**
     * @dev Sets `value` as the allowance of `spender` over ``owner``'s tokens,
     * given ``owner``'s signed approval.
     *
     * IMPORTANT: The same issues {IERC20-approve} has related to transaction
     * ordering also apply here.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `deadline` must be a timestamp in the future.
     * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the EIP712-formatted function arguments.
     * - the signature must use ``owner``'s current nonce (see {nonces}).
     *
     * For more information on the signature format, see the
     * https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
     * section].
     *
     * CAUTION: See Security Considerations above.
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @dev Returns the current nonce for `owner`. This value must be
     * included whenever a signature is generated for {permit}.
     *
     * Every successful call to {permit} increases ``owner``'s nonce by one. This
     * prevents a signature from being used multiple times.
     */
    function nonces(address owner) external view returns (uint256);

    /**
     * @dev Returns the domain separator used in the encoding of the signature for {permit}, as defined by {EIP712}.
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}


// ===== node_modules/@openzeppelin/contracts/utils/Address.sol =====
// OpenZeppelin Contracts (last updated v4.9.0) (utils/Address.sol)

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     *
     * Furthermore, `isContract` will also return true if the target contract within
     * the same transaction is already scheduled for destruction by `SELFDESTRUCT`,
     * which only has an effect at the end of a transaction.
     * ====
     *
     * [IMPORTANT]
     * ====
     * You shouldn't rely on `isContract` to protect against flash loan attacks!
     *
     * Preventing calls from contracts is highly discouraged. It breaks composability, breaks support for smart wallets
     * like Gnosis Safe, and does not provide security since it can be circumvented by calling from a contract
     * constructor.
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize/address.code.length, which returns 0
        // for contracts in construction, since the code is only stored at the end
        // of the constructor execution.

        return account.code.length > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.0/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and revert (either by bubbling
     * the revert reason or using the provided one) in case of unsuccessful call or if target was not a contract.
     *
     * _Available since v4.8._
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        if (success) {
            if (returndata.length == 0) {
                // only check isContract if the call was successful and the return data is empty
                // otherwise we already know that it was a contract
                require(isContract(target), "Address: call to non-contract");
            }
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and revert if it wasn't, either by bubbling the
     * revert reason or using the provided one.
     *
     * _Available since v4.3._
     */
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function _revert(bytes memory returndata, string memory errorMessage) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert(errorMessage);
        }
    }
}


// ===== node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol =====
// OpenZeppelin Contracts (last updated v4.9.3) (token/ERC20/utils/SafeERC20.sol)





/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    using Address for address;

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    /**
     * @dev Deprecated. This function has issues similar to the ones found in
     * {IERC20-approve}, and its usage is discouraged.
     *
     * Whenever possible, use {safeIncreaseAllowance} and
     * {safeDecreaseAllowance} instead.
     */
    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        require(
            (value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve from non-zero to non-zero allowance"
        );
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, oldAllowance + value));
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        unchecked {
            uint256 oldAllowance = token.allowance(address(this), spender);
            require(oldAllowance >= value, "SafeERC20: decreased allowance below zero");
            _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, oldAllowance - value));
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeWithSelector(token.approve.selector, spender, value);

        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, 0));
            _callOptionalReturn(token, approvalCall);
        }
    }

    /**
     * @dev Use a ERC-2612 signature to set the `owner` approval toward `spender` on `token`.
     * Revert on invalid signature.
     */
    function safePermit(
        IERC20Permit token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        uint256 nonceBefore = token.nonces(owner);
        token.permit(owner, spender, value, deadline, v, r, s);
        uint256 nonceAfter = token.nonces(owner);
        require(nonceAfter == nonceBefore + 1, "SafeERC20: permit did not succeed");
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We use {Address-functionCall} to perform this call, which verifies that
        // the target address contains contract code and also asserts for success in the low-level call.

        bytes memory returndata = address(token).functionCall(data, "SafeERC20: low-level call failed");
        require(returndata.length == 0 || abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     *
     * This is a variant of {_callOptionalReturn} that silents catches all reverts and returns a bool instead.
     */
    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We cannot use {Address-functionCall} here since this should return false
        // and not revert is the subcall reverts.

        (bool success, bytes memory returndata) = address(token).call(data);
        return
            success && (returndata.length == 0 || abi.decode(returndata, (bool))) && Address.isContract(address(token));
    }
}


// ===== contracts/SpotDF.sol =====
/* ─────────────────────────────────────────────────────────────────────────────
   SpotDF.sol — El contrato que opera la seccion Spot de DecFreedom. Proxy UUPS.
   Red: BNB Smart Chain. Swaps por PancakeSwap V2. Clona el andamiaje PROBADO y
   desplegado de contracts/terminal/TerminalSwap.sol (multi-owner de dos pasos,
   reparto de comision que nunca revierte, reporte a Contabilidad por oraculo, guard
   de reentrancia, pausa, envio seguro con retiro pull) y le añade el corazon de Spot:
   abrir y cerrar posiciones long y short con auto-conversion, cobrando 1% SOLO sobre
   la ganancia.

   ░░ NO CUSTODIAL (por pre-aprobacion / allowance) ░░
   Los fondos del usuario SIEMPRE viven en SU wallet. El contrato NUNCA guarda capital
   entre operaciones: en cada abrir o cerrar, el dinero entra de la wallet y sale a la
   wallet en la MISMA transaccion. No hay un bote con los fondos de todos, asi que no
   hay honeypot que robar: aunque alguien vaciara el contrato, no habria nada dentro.

   Como funciona el automatico (TP / SL / limit) sin que el usuario firme cada vez:
   el usuario firma UNA aprobacion (approve) por adelantado de los tokens que opera.
   Con esa aprobacion, cuando el precio llega, el keeper de la plataforma llama a cerrar:
   el contrato tira (transferFrom) justo lo de esa posicion desde la wallet del usuario,
   hace el swap al precio validado y devuelve el resultado a la misma wallet. El usuario
   puede revocar la aprobacion cuando quiera. El keeper SOLO puede cerrar respetando el
   piso (floorOut) que el usuario fijo, asi un cierre automatico nunca lo liquida peor
   del precio que acepto.

     · LONG X: el capital se convierte a USDT y con el USDT se compra X; X va a la wallet
       del usuario. Al cerrar, el contrato tira X de la wallet, lo vende por USDT: la
       ganancia es en USDT. Si gana, 1% de la ganancia.
     · SHORT X: el capital se convierte a USDT y el USDT va a la wallet del usuario como
       colateral; se guarda cuanta X compraria ese USDT hoy (la referencia). Al cerrar, el
       contrato tira el USDT de la wallet y compra X: si bajo, compra MAS X que la
       referencia y esa diferencia es la ganancia (en la moneda). Si gana, 1% de esa X.

   Comision: 1% (tope fijo FEE_MAX_BPS), SOLO al cerrar en POSITIVO. Se toma de la ganancia,
   se convierte a BNB y se reparte EXACTO: 10% Staking, 45% owner1, 45% owner2. Se reporta a
   Contabilidad el valor en USD (clave keccak("spot")). Abrir una posicion es GRATIS.

   Anti-gap: todo swap exige minOut y deadline que fija quien llama; un movimiento rapido que
   deje el precio peor que minOut revierte, no ejecuta un mal llenado. Nunca deja aprobaciones
   abiertas hacia el router: aprueba lo justo de cada swap y lo deja en cero.

   AVISO: maneja ordenes de pago de usuarios por allowance. Exige auditoria profesional
   independiente y pruebas en testnet de BSC antes de mainnet con dinero real.
   ───────────────────────────────────────────────────────────────────────────── */

interface IRouterV2 {
    function WETH() external pure returns (address);
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable;
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external;
}
interface IContabilidadS { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }
interface IOraculoS { function precioUSD(address token) external view returns (uint256); } // precioUSD(address(0)) = USD por 1 BNB (18 dec)

contract SpotDF is Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /* ─────────── Roles e interconexion (molde de TerminalSwap) ─────────── */
    mapping(address => bool) public esOwner;
    address[] private ownersList;
    address public owner1;
    address public owner2;
    address public owner1Propuesto;
    address public owner2Propuesto;
    mapping(address => bool) public esKeeper;   // puede disparar cierres (TP/SL), respetando el piso del usuario
    address public staking;
    address public contabilidad;
    address public oraculo;
    address public router;                        // PancakeSwap V2 Router
    address public wbnb;                          // leido del router al inicializar
    address public usdt;                          // base de cuenta de las posiciones

    /* ─────────── Comision ─────────── */
    uint256 public constant BPS = 10000;
    uint256 public constant FEE_MAX_BPS = 100;    // 1%: tope fijo en el codigo
    uint256 public feeBps;                         // comision SOBRE LA GANANCIA al cerrar en positivo
    uint256 public stakingBps;                     // parte de la comision al staking (1000 = 10%)
    bytes32 public constant CLAVE_CONT = keccak256("spot");

    mapping(address => uint256) public saldoRetirable; // pull: BNB que un destino no pudo recibir
    bool public pausado;
    bool private _entrada;

    /* ─────────── Posiciones (solo registro; los fondos viven en la wallet del usuario) ─────────── */
    struct Pos {
        address user;      // dueño (en su wallet estan los fondos)
        address coin;      // moneda operada (la de la grafica)
        bool    esShort;   // false = long, true = short
        uint256 qty;       // long: cantidad de coin del usuario comprometida (en su wallet)
        uint256 costo;     // long: USDT invertido (base de coste). short: USDT colateral (en su wallet)
        uint256 refQty;    // short: cantidad de coin de referencia (lo que el USDT compraba al abrir)
        uint256 floorOut;  // minimo de salida que el usuario acepta en un cierre por keeper
        uint40  t;         // apertura
        bool    abierta;
    }
    Pos[] public posiciones;                       // id = indice
    mapping(address => uint256[]) public posDe;    // wallet => ids
    uint256 public abiertasTotal;

    /* Parametros para abrir (en un struct para no agotar la pila: "stack too deep").
       coin: moneda de la grafica. input: con que paga (address(0)=BNB via msg.value).
       pagar: cantidad del token input (si es BNB se ignora y vale msg.value; el input token
              necesita approve previo a este contrato).
       rutaAUsdt: ruta PancakeSwap input->USDT (vacia validada si input ya es USDT).
       minUsdt: minimo de USDT de esa conversion (anti-gap).
       rutaCoin: long = ruta USDT->coin (swap real). short = ruta USDT->coin (solo cotizar referencia).
       minCoin: long = minimo de coin a comprar. short = 0 (no se compra al abrir).
       floorOut: minimo de salida que aceptas si un keeper te cierra. deadline: limite. */
    struct Abrir {
        address coin; address input; uint256 pagar;
        address[] rutaAUsdt; uint256 minUsdt;
        address[] rutaCoin; uint256 minCoin;
        uint256 floorOut; uint256 deadline;
    }

    /* ─────────── Estadisticas ─────────── */
    uint256 public comisionBNB;    // comision total convertida a BNB
    uint256 public cierresGanadores;
    uint256 public operaciones;

    /* ─────────── Fase B · Comision de gas autosustentable (nuevas; consumen __gap) ───────────
       Al ABRIR, el usuario (que ya firma esa misma tx) paga una pizca fija en BNB que va DIRECTO
       a la wallet keeper, para que esta se pague su propio gas de los cierres automaticos. No va
       a los owners. No agrega ninguna firma: es parte de la misma tx de apertura. Default 0 =
       apagado, hasta que el owner fije la wallet y el monto. */
    address public walletKeeper;   // destino de la comision de gas (la wallet que firma los cierres)
    uint256 public feeAperturaWei; // comision fija en BNB por apertura (ej. 0.001 BNB = 1e15)

    /* ─────────── Eventos ─────────── */
    event Abierta(uint256 indexed id, address indexed user, address indexed coin, bool esShort, uint256 costoUsdt, uint256 qty, uint256 refQty);
    event Cerrada(uint256 indexed id, address indexed user, address indexed coin, bool esShort, uint256 salida, uint256 ganancia, uint256 feeCobrado, address porQuien);
    event Abandonada(uint256 indexed id, address indexed user);
    event ComisionRepartida(uint256 aStaking, uint256 aOwner1, uint256 aOwner2, bool stakingOk);
    event PisoCambiado(uint256 indexed id, uint256 floorOut);
    event OwnerCambiado(address indexed quien, bool esOwner);
    event OwnerPropuesto(uint8 cual, address propuesto);
    event KeeperCambiado(address indexed quien, bool v);
    event ParamCambiado(string nombre, address valor);
    event ComisionConfigurada(uint256 feeBps, uint256 stakingBps);
    event Pausa(bool pausado);
    event Retiro(address indexed quien, uint256 monto);
    event FeeAperturaCobrada(address indexed user, uint256 montoBnb, bool okEnvio);
    event FeeAperturaConfig(address walletKeeper, uint256 feeWei);

    error NoAutorizado(); error Reentrada(); error Pausado(); error Params(); error Cantidad(); error Ruta(); error Vencido(); error NoAbierta();

    modifier soloOwner() { if (!esOwner[msg.sender]) revert NoAutorizado(); _; }
    modifier noReentrada() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _owner1, address _owner2, address _staking, address _contabilidad, address _oraculo, address _router, address _usdt) external initializer {
        if (_owner1 == address(0) || _owner2 == address(0) || _router == address(0) || _usdt == address(0)) revert Params();
        owner1 = _owner1; owner2 = _owner2;
        staking = _staking; contabilidad = _contabilidad; oraculo = _oraculo;
        router = _router; usdt = _usdt;
        wbnb = IRouterV2(_router).WETH();
        feeBps = 100;        // 1% de la ganancia
        stakingBps = 1000;   // 10% de la comision va al staking
        _addOwner(_owner1); _addOwner(_owner2);
        emit ComisionConfigurada(feeBps, stakingBps);
    }

    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════════════════════════════════════════════════════════════════════
       ABRIR LONG — el capital se vuelve USDT, con el USDT se compra la moneda y la
       moneda se MANDA A LA WALLET del usuario. Solo se registra la posicion (para el
       calculo del fee y para que el keeper pueda cerrarla despues con su approve).
       ═══════════════════════════════════════════════════════════════════════════ */
    function abrirLong(Abrir calldata q) external payable activo noReentrada returns (uint256 id) {
        if (q.coin == address(0) || q.coin == usdt) revert Params();
        if (block.timestamp > q.deadline) revert Vencido();
        uint256 bnbCap = _cobrarApertura(q.input);
        uint256 enUsdt = _recibirComoUsdt(q.input, q.pagar, q.rutaAUsdt, q.minUsdt, q.deadline, bnbCap);
        if (enUsdt == 0) revert Cantidad();
        uint256 qty = _swapToken(usdt, q.coin, enUsdt, q.minCoin, q.rutaCoin, q.deadline);
        if (qty == 0) revert Cantidad();
        IERC20(q.coin).safeTransfer(msg.sender, qty);     // la moneda va a la WALLET del usuario (no custodia)
        id = _registrar(q.coin, false, qty, enUsdt, 0, q.floorOut);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       ABRIR SHORT — el capital se vuelve USDT y el USDT se MANDA A LA WALLET del usuario
       como colateral. Se guarda cuanta moneda compraria ese USDT ahora (la referencia).
       ═══════════════════════════════════════════════════════════════════════════ */
    function abrirShort(Abrir calldata q) external payable activo noReentrada returns (uint256 id) {
        if (q.coin == address(0) || q.coin == usdt) revert Params();
        if (block.timestamp > q.deadline) revert Vencido();
        uint256 bnbCap = _cobrarApertura(q.input);
        uint256 enUsdt = _recibirComoUsdt(q.input, q.pagar, q.rutaAUsdt, q.minUsdt, q.deadline, bnbCap);
        if (enUsdt == 0) revert Cantidad();
        uint256 refQty = _cotizar(enUsdt, q.rutaCoin, usdt, q.coin);
        if (refQty == 0) revert Cantidad();
        IERC20(usdt).safeTransfer(msg.sender, enUsdt);     // el USDT (colateral) va a la WALLET del usuario
        id = _registrar(q.coin, true, 0, enUsdt, refQty, q.floorOut);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       CERRAR — tira los fondos de la WALLET del usuario (necesita su approve previo),
       hace el swap y devuelve el resultado a la misma wallet, todo en una tx. Lo puede
       llamar el dueño (en cualquier momento) o un keeper (solo para TP/SL y SIEMPRE
       respetando el piso floorOut). minOut lo fija quien llama (anti-gap); si no es el
       dueño, minOut debe ser >= floorOut. ruta: long = coin->USDT; short = USDT->coin.
       ═══════════════════════════════════════════════════════════════════════════ */
    function cerrar(uint256 id, address[] calldata ruta, uint256 minOut, uint256 deadline) external noReentrada {
        if (id >= posiciones.length) revert Params();
        Pos storage p = posiciones[id];
        if (!p.abierta) revert NoAbierta();
        if (block.timestamp > deadline) revert Vencido();
        if (msg.sender != p.user) {
            if (!esKeeper[msg.sender]) revert NoAutorizado();
            if (minOut < p.floorOut) revert Cantidad();     // un keeper nunca cierra por debajo del piso
        }
        p.abierta = false;                                   // efecto antes de interaccion
        abiertasTotal -= 1; operaciones += 1;
        if (!p.esShort) _cerrarLong(id, p, ruta, minOut, deadline);
        else            _cerrarShort(id, p, ruta, minOut, deadline);
    }

    function _cerrarLong(uint256 id, Pos storage p, address[] calldata ruta, uint256 minOut, uint256 deadline) internal {
        // Traer la moneda DESDE la wallet del usuario (approve previo). Medir lo recibido (tokens con impuesto).
        uint256 antes = IERC20(p.coin).balanceOf(address(this));
        IERC20(p.coin).safeTransferFrom(p.user, address(this), p.qty);
        uint256 tengo = IERC20(p.coin).balanceOf(address(this)) - antes;
        if (tengo == 0) revert Cantidad();
        uint256 proceeds = _swapToken(p.coin, usdt, tengo, minOut, ruta, deadline);
        uint256 ganancia = proceeds > p.costo ? (proceeds - p.costo) : 0;
        uint256 cobrado = 0;
        if (ganancia > 0) { cobrado = _cobrarFee(usdt, ganancia * feeBps / BPS, p.user, deadline); if (cobrado > 0) cierresGanadores += 1; }
        uint256 alUsuario = proceeds - cobrado;
        if (alUsuario > 0) IERC20(usdt).safeTransfer(p.user, alUsuario);
        emit Cerrada(id, p.user, p.coin, false, proceeds, ganancia, cobrado, msg.sender);
    }

    function _cerrarShort(uint256 id, Pos storage p, address[] calldata ruta, uint256 minOut, uint256 deadline) internal {
        // Traer el USDT (colateral) DESDE la wallet del usuario (approve previo).
        IERC20(usdt).safeTransferFrom(p.user, address(this), p.costo);
        uint256 nuevaQty = _swapToken(usdt, p.coin, p.costo, minOut, ruta, deadline);
        uint256 ganancia = nuevaQty > p.refQty ? (nuevaQty - p.refQty) : 0;   // ganancia EN la moneda
        uint256 cobrado = 0;
        if (ganancia > 0) { cobrado = _cobrarFee(p.coin, ganancia * feeBps / BPS, p.user, deadline); if (cobrado > 0) cierresGanadores += 1; }
        uint256 alUsuario = nuevaQty - cobrado;
        if (alUsuario > 0) IERC20(p.coin).safeTransfer(p.user, alUsuario);
        emit Cerrada(id, p.user, p.coin, true, nuevaQty, ganancia, cobrado, msg.sender);
    }

    /** El usuario descarta una posicion SIN mover fondos (p.ej. si ya movio la moneda por
        fuera). Solo limpia el registro; no toca dinero. */
    function abandonar(uint256 id) external {
        Pos storage p = posiciones[id];
        if (msg.sender != p.user) revert NoAutorizado();
        if (!p.abierta) revert NoAbierta();
        p.abierta = false; abiertasTotal -= 1;
        emit Abandonada(id, msg.sender);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       Internos de fondos
       ═══════════════════════════════════════════════════════════════════════════ */

    /** Cobra la comision FIJA de gas al abrir y la envia a la wallet keeper, para que esta se
        pague sus propios cierres automaticos. Corre DENTRO de la misma tx que el usuario ya firma
        para abrir, asi que NO agrega ninguna firma ni paso. Devuelve el BNB NETO (capital) cuando
        se paga en BNB. Si walletKeeper es 0 o feeAperturaWei es 0, la comision esta apagada y el
        comportamiento es el de siempre. La comision NO va a los owners: solo a la wallet keeper. */
    function _cobrarApertura(address input) internal returns (uint256 bnbCapital) {
        uint256 fee = (walletKeeper != address(0)) ? feeAperturaWei : 0;
        if (input == address(0)) {           // paga con BNB: msg.value = capital + fee
            if (msg.value <= fee) revert Cantidad();
            bnbCapital = msg.value - fee;
        } else {                             // paga con token/USDT: msg.value debe ser EXACTO el fee (0 si apagado)
            if (msg.value != fee) revert Params();
            bnbCapital = 0;
        }
        if (fee > 0) {
            (bool ok, ) = payable(walletKeeper).call{value: fee, gas: 30000}("");
            if (!ok) saldoRetirable[walletKeeper] += fee;   // pull si el envio directo falla
            emit FeeAperturaCobrada(msg.sender, fee, ok);
        }
    }

    /** Recibe el pago del usuario (BNB o token, con approve previo si es token) y lo deja en
        USDT dentro del contrato SOLO durante esta tx. Devuelve el USDT obtenido (medido). */
    function _recibirComoUsdt(address input, uint256 pagar, address[] calldata ruta, uint256 minUsdt, uint256 deadline, uint256 bnbIn) internal returns (uint256) {
        uint256 antes = IERC20(usdt).balanceOf(address(this));
        if (input == address(0)) {
            if (bnbIn == 0) revert Cantidad();
            _validarRuta(ruta, wbnb, usdt);
            IRouterV2(router).swapExactETHForTokensSupportingFeeOnTransferTokens{value: bnbIn}(minUsdt, ruta, address(this), deadline);
        } else if (input == usdt) {
            if (pagar == 0) revert Cantidad();
            IERC20(usdt).safeTransferFrom(msg.sender, address(this), pagar);
        } else {
            if (pagar == 0) revert Cantidad();
            uint256 antesIn = IERC20(input).balanceOf(address(this));
            IERC20(input).safeTransferFrom(msg.sender, address(this), pagar);
            uint256 rec = IERC20(input).balanceOf(address(this)) - antesIn;
            if (rec == 0) revert Cantidad();
            _validarRuta(ruta, input, usdt);
            IERC20(input).forceApprove(router, rec);
            IRouterV2(router).swapExactTokensForTokensSupportingFeeOnTransferTokens(rec, minUsdt, ruta, address(this), deadline);
            IERC20(input).forceApprove(router, 0);
        }
        uint256 got = IERC20(usdt).balanceOf(address(this)) - antes;
        if (got < minUsdt) revert Cantidad();
        return got;
    }

    /** Swap token->token (el contrato ya tiene `amount`), midiendo la salida real. Valida extremos. */
    function _swapToken(address from, address to, uint256 amount, uint256 minOut, address[] calldata ruta, uint256 deadline) internal returns (uint256) {
        if (amount == 0) revert Cantidad();
        _validarRuta(ruta, from, to);
        uint256 antes = IERC20(to).balanceOf(address(this));
        IERC20(from).forceApprove(router, amount);
        IRouterV2(router).swapExactTokensForTokensSupportingFeeOnTransferTokens(amount, minOut, ruta, address(this), deadline);
        IERC20(from).forceApprove(router, 0);
        uint256 got = IERC20(to).balanceOf(address(this)) - antes;
        if (got < minOut) revert Cantidad();
        return got;
    }

    /** Toma `feeAmt` de `feeAsset`, lo convierte a BNB y lo reparte. Devuelve el feeAsset
        REALMENTE cobrado: feeAmt si todo salio bien, 0 si no se pudo convertir (en ese caso
        NO se cobra al usuario y nada queda atascado). */
    function _cobrarFee(address feeAsset, uint256 feeAmt, address user, uint256 deadline) internal returns (uint256) {
        if (feeAmt == 0) return 0;
        address[] memory ruta;
        if (feeAsset == usdt) { ruta = new address[](2); ruta[0] = usdt; ruta[1] = wbnb; }
        else { ruta = new address[](3); ruta[0] = feeAsset; ruta[1] = usdt; ruta[2] = wbnb; }
        uint256 minBnb;
        try IRouterV2(router).getAmountsOut(feeAmt, ruta) returns (uint256[] memory a) { minBnb = a[a.length - 1] * 90 / 100; } catch { return 0; }
        if (minBnb == 0) return 0;
        uint256 antes = address(this).balance;
        IERC20(feeAsset).forceApprove(router, feeAmt);
        try IRouterV2(router).swapExactTokensForETHSupportingFeeOnTransferTokens(feeAmt, minBnb, ruta, address(this), deadline) {
            IERC20(feeAsset).forceApprove(router, 0);
            uint256 feeBnb = address(this).balance - antes;
            if (feeBnb == 0) return 0;
            comisionBNB += feeBnb;
            _repartir(feeBnb);
            _reportar(user, feeBnb);
            return feeAmt;
        } catch {
            IERC20(feeAsset).forceApprove(router, 0);
            return 0;
        }
    }

    function _cotizar(uint256 amount, address[] calldata ruta, address from, address to) internal view returns (uint256) {
        _validarRuta(ruta, from, to);
        uint256[] memory a = IRouterV2(router).getAmountsOut(amount, ruta);
        return a[a.length - 1];
    }

    function _validarRuta(address[] calldata ruta, address from, address to) internal pure {
        if (ruta.length < 2 || ruta.length > 4) revert Ruta();
        if (ruta[0] != from || ruta[ruta.length - 1] != to) revert Ruta();
    }

    function _registrar(address coin, bool esShort, uint256 qty, uint256 costo, uint256 refQty, uint256 floorOut) internal returns (uint256 id) {
        id = posiciones.length;
        posiciones.push(Pos({ user: msg.sender, coin: coin, esShort: esShort, qty: qty, costo: costo, refQty: refQty, floorOut: floorOut, t: uint40(block.timestamp), abierta: true }));
        posDe[msg.sender].push(id);
        abiertasTotal += 1; operaciones += 1;
        emit Abierta(id, msg.sender, coin, esShort, costo, qty, refQty);
    }

    /* ═══════════ Reparto de la comision: 10% staking, 45% owner1, 45% owner2 (molde TerminalSwap) ═══════════ */
    function _repartir(uint256 fee) internal {
        if (fee == 0) return;
        uint256 aStk = fee * stakingBps / BPS;
        uint256 resto = fee - aStk;
        uint256 a1 = resto / 2;
        uint256 a2 = resto - a1;
        bool okS = false;
        if (aStk > 0 && staking != address(0)) {
            (okS,) = staking.call{value: aStk}(abi.encodeWithSignature("depositarRecompensaBNB(uint16)", uint16(10000)));
        }
        if (!okS && aStk > 0) { a1 += aStk / 2; a2 += aStk - aStk / 2; aStk = 0; }
        _enviarSeguro(owner1, a1);
        _enviarSeguro(owner2, a2);
        emit ComisionRepartida(aStk, a1, a2, okS);
    }

    function _enviarSeguro(address a, uint256 m) internal {
        if (m == 0 || a == address(0)) return;
        (bool ok,) = payable(a).call{value: m, gas: 30000}("");
        if (!ok) saldoRetirable[a] += m;
    }

    function retirar() external noReentrada {
        uint256 m = saldoRetirable[msg.sender];
        if (m == 0) revert Cantidad();
        saldoRetirable[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: m}("");
        require(ok, "retiro");
        emit Retiro(msg.sender, m);
    }

    /* ═══════════ Contabilidad (nunca rompe el flujo) ═══════════ */
    function _reportar(address wallet, uint256 feeBNB) internal {
        if (contabilidad == address(0)) return;
        uint256 usd = _bnbAUsd(feeBNB);
        uint256 aStk = usd * stakingBps / BPS;
        try IContabilidadS(contabilidad).reportar(wallet, CLAVE_CONT, usd, aStk, usd - aStk) {} catch {}
    }
    function _bnbAUsd(uint256 bnb) internal view returns (uint256) {
        if (oraculo == address(0) || bnb == 0) return 0;
        try IOraculoS(oraculo).precioUSD(address(0)) returns (uint256 p) { return bnb * p / 1e18; } catch { return 0; }
    }

    /* ═══════════ Lecturas ═══════════ */
    function posicionInfo(uint256 id) external view returns (Pos memory) { return posiciones[id]; }
    function posicionesDe(address w) external view returns (uint256[] memory) { return posDe[w]; }
    function totalPosiciones() external view returns (uint256) { return posiciones.length; }

    /** El usuario sube o baja su piso de cierre por keeper (no afecta a su cierre manual). */
    function setFloor(uint256 id, uint256 floorOut) external {
        Pos storage p = posiciones[id];
        if (msg.sender != p.user) revert NoAutorizado();
        if (!p.abierta) revert NoAbierta();
        p.floorOut = floorOut;
        emit PisoCambiado(id, floorOut);
    }

    /* ═══════════ Owners (molde exacto de TerminalSwap) ═══════════ */
    function owners() external view returns (address[] memory) { return ownersList; }
    function addOwner(address a) external soloOwner { _addOwner(a); }
    function removeOwner(address a) external soloOwner {
        if (!esOwner[a] || a == owner1 || a == owner2) revert Params();
        esOwner[a] = false;
        for (uint256 k = 0; k < ownersList.length; k++) if (ownersList[k] == a) { ownersList[k] = ownersList[ownersList.length - 1]; ownersList.pop(); break; }
        emit OwnerCambiado(a, false);
    }
    function _addOwner(address a) internal { if (a == address(0)) revert Params(); if (!esOwner[a]) { esOwner[a] = true; ownersList.push(a); emit OwnerCambiado(a, true); } }
    function setOwner1(address a) external soloOwner { if (a == address(0)) revert Params(); owner1 = a; _addOwner(a); emit ParamCambiado("owner1", a); }
    function setOwner2(address a) external soloOwner { if (a == address(0)) revert Params(); owner2 = a; _addOwner(a); emit ParamCambiado("owner2", a); }
    function proponerOwner1(address a) external soloOwner { if (a == address(0)) revert Params(); owner1Propuesto = a; emit OwnerPropuesto(1, a); }
    function aceptarOwner1() external { if (msg.sender != owner1Propuesto) revert NoAutorizado(); owner1 = msg.sender; _addOwner(msg.sender); owner1Propuesto = address(0); emit ParamCambiado("owner1", msg.sender); }
    function proponerOwner2(address a) external soloOwner { if (a == address(0)) revert Params(); owner2Propuesto = a; emit OwnerPropuesto(2, a); }
    function aceptarOwner2() external { if (msg.sender != owner2Propuesto) revert NoAutorizado(); owner2 = msg.sender; _addOwner(msg.sender); owner2Propuesto = address(0); emit ParamCambiado("owner2", msg.sender); }

    /* ═══════════ Keeper y parametros ═══════════ */
    function setKeeper(address a, bool v) external soloOwner { if (a == address(0)) revert Params(); esKeeper[a] = v; emit KeeperCambiado(a, v); }
    /** Fija la wallet que recibe la comision de gas de las aperturas (la que firma los cierres). */
    function setWalletKeeper(address a) external soloOwner { walletKeeper = a; emit FeeAperturaConfig(a, feeAperturaWei); }
    /** Fija la comision fija en BNB por apertura (ej. 1e15 = 0.001 BNB). Tope 0.02 BNB para que
        nunca sea abusiva. 0 = apagada. */
    function setFeeApertura(uint256 weiPorApertura) external soloOwner { if (weiPorApertura > 0.02 ether) revert Params(); feeAperturaWei = weiPorApertura; emit FeeAperturaConfig(walletKeeper, weiPorApertura); }
    function setStaking(address a) external soloOwner { staking = a; emit ParamCambiado("staking", a); }
    function setContabilidad(address a) external soloOwner { contabilidad = a; emit ParamCambiado("contabilidad", a); }
    function setOraculo(address a) external soloOwner { oraculo = a; emit ParamCambiado("oraculo", a); }
    function setRouter(address a) external soloOwner { if (a == address(0)) revert Params(); router = a; wbnb = IRouterV2(a).WETH(); emit ParamCambiado("router", a); }
    function setUsdt(address a) external soloOwner { if (a == address(0)) revert Params(); usdt = a; emit ParamCambiado("usdt", a); }
    function setComision(uint256 _feeBps, uint256 _stakingBps) external soloOwner {
        if (_feeBps > FEE_MAX_BPS || _stakingBps > BPS) revert Params();
        feeBps = _feeBps; stakingBps = _stakingBps;
        emit ComisionConfigurada(_feeBps, _stakingBps);
    }
    function pausar(bool v) external soloOwner { pausado = v; emit Pausa(v); }

    /* El BNB solo entra desde el router (al convertir el fee a BNB). El pago de un abrir llega
       como msg.value a abrir*, no por aqui. Asi nada de BNB se atasca. */
    receive() external payable { if (msg.sender != router) revert Cantidad(); }

    uint256[38] private __gap;   // era 40; -2 por walletKeeper y feeAperturaWei (el layout no se mueve)
}
