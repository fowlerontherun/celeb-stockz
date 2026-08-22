# Conditional sell orders

New limit, stop-market, and stop-limit sell orders persist the exact share quantity chosen when the order is placed. The execution engine uses that stored quantity at trigger time while applying the current execution price and transaction fee.

Older open sell orders without a stored quantity remain supported through the previous value-based fallback.
