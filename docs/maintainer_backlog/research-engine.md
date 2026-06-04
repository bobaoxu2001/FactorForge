# Research Engine Backlog

## Backtest edge cases

Add or expand tests for:

- Missing bars and uneven benchmark calendars.
- Entry signals near the end of the series.
- Stop loss and trailing stop precedence.
- Slippage and fee behavior on short holding periods.
- Flat-to-long and long-to-flat transitions with no trades.

## Selection assumptions

The strategy detail page defaults to the highest-scoring symbol for a strategy and discloses that selection-bias assumption. Keep this visible whenever ranking or symbol-switching behavior changes.

## Factor attribution

Evaluate whether proxied factor baskets should be supplemented or replaced by imported factor return datasets. Any change should preserve clear source labels and fixture-based tests.
