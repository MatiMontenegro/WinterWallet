// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  FeeRouter
/// @notice Forwards native or ERC-20 transfers to a recipient, deducting a
///         fee in basis points (bps). Fee accumulates inside the contract and
///         can be withdrawn by the owner.
///
///         Hard-coded ceiling: the fee can never exceed MAX_FEE_BPS (1%) —
///         the owner cannot rug-pull users by silently raising the rate.
///
/// @dev    Audit notes:
///           - Reentrancy guarded with a transient lock.
///           - Native send uses `call` with no return-data check (we cannot
///             trust recipients to revert nicely; we revert ourselves on
///             call failure).
///           - ERC-20 transfers use the SafeERC20-style "check return data"
///             pattern, so non-standard tokens (USDT, etc.) work too.
///           - Owner is set at construction; transfer is two-step (propose +
///             accept) to avoid fat-finger lockouts.
contract FeeRouter {
    // -------------------------------------------------------------- events
    event Forwarded(
        address indexed from,
        address indexed to,
        address indexed token,    // address(0) for native
        uint256 totalAmount,
        uint256 fee
    );
    event FeeUpdated(uint16 oldBps, uint16 newBps);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event OwnerProposed(address indexed proposed);
    event OwnerAccepted(address indexed previous, address indexed current);

    // -------------------------------------------------------------- errors
    error NotOwner();
    error NotProposed();
    error FeeTooHigh(uint16 requested, uint16 max);
    error ZeroAmount();
    error NativeSendFailed();
    error TokenTransferFailed();
    error Reentrancy();

    // -------------------------------------------------------------- storage
    uint16 public constant MAX_FEE_BPS = 100;     // 1.00% — hard ceiling

    address public owner;
    address public proposedOwner;
    uint16  public feeBps;                         // current fee

    uint256 private _locked = 1;                   // 1 = unlocked, 2 = locked

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    modifier nonReentrant() {
        if (_locked == 2) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    // ------------------------------------------------------------ constructor
    constructor(address _owner, uint16 _feeBps) {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_FEE_BPS);
        owner = _owner;
        feeBps = _feeBps;
        emit FeeUpdated(0, _feeBps);
        emit OwnerAccepted(address(0), _owner);
    }

    // ---------------------------------------------------------- send native
    /// @notice Forward `msg.value` to `to`, less the `feeBps` fee.
    function sendNative(address payable to) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 sendAmount = msg.value - fee;

        (bool ok, ) = to.call{value: sendAmount}("");
        if (!ok) revert NativeSendFailed();

        emit Forwarded(msg.sender, to, address(0), msg.value, fee);
        // Fee remains in the contract — owner sweeps via withdraw(address(0)).
    }

    // ------------------------------------------------------------ send ERC-20
    /// @notice Forward `totalAmount` of `token` to `to`, less the fee.
    /// @dev    Requires prior `approve(address(this), totalAmount)`.
    function sendToken(address token, address to, uint256 totalAmount) external nonReentrant {
        if (totalAmount == 0) revert ZeroAmount();

        uint256 fee = (totalAmount * feeBps) / 10_000;
        uint256 sendAmount = totalAmount - fee;

        // Pull the full amount from the sender to this contract.
        _safeTransferFrom(token, msg.sender, address(this), totalAmount);
        // Forward the recipient's portion.
        _safeTransfer(token, to, sendAmount);
        // Fee remains here.

        emit Forwarded(msg.sender, to, token, totalAmount, fee);
    }

    // ------------------------------------------------------------ accumulated
    function accumulated(address token) external view returns (uint256) {
        if (token == address(0)) return address(this).balance;
        return _erc20BalanceOf(token, address(this));
    }

    // -------------------------------------------------------------- withdraw
    /// @notice Sweep `token` (or address(0) for native) to `owner`.
    function withdraw(address token) external onlyOwner nonReentrant {
        uint256 amount;
        if (token == address(0)) {
            amount = address(this).balance;
            if (amount == 0) revert ZeroAmount();
            (bool ok, ) = payable(owner).call{value: amount}("");
            if (!ok) revert NativeSendFailed();
        } else {
            amount = _erc20BalanceOf(token, address(this));
            if (amount == 0) revert ZeroAmount();
            _safeTransfer(token, owner, amount);
        }
        emit Withdrawn(token, owner, amount);
    }

    // ------------------------------------------------------------- governance
    function setFeeBps(uint16 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh(newBps, MAX_FEE_BPS);
        emit FeeUpdated(feeBps, newBps);
        feeBps = newBps;
    }

    function proposeOwner(address newOwner) external onlyOwner {
        proposedOwner = newOwner;
        emit OwnerProposed(newOwner);
    }

    function acceptOwner() external {
        if (msg.sender != proposedOwner) revert NotProposed();
        emit OwnerAccepted(owner, msg.sender);
        owner = msg.sender;
        proposedOwner = address(0);
    }

    // ----------------------------------------------------------- ERC-20 utils
    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb /* transfer(address,uint256) */, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd /* transferFrom(address,address,uint256) */, from, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _erc20BalanceOf(address token, address acct) internal view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(0x70a08231 /* balanceOf(address) */, acct)
        );
        if (!ok || data.length < 32) return 0;
        return abi.decode(data, (uint256));
    }

    // Allow plain native deposits (e.g. someone sends ETH directly). They go
    // straight to the operator's accumulated balance.
    receive() external payable {}
}
