# PLAN: Fix Data Import and Enhance Dashboard Metrics

## ANALYSIS
The user reports a total failure in data import (results are 0) after recent changes. Additionally, the dashboard needs to display both Brute and Attenuated results in the "Escore Geral" card, with clear information about the attenuation motive.

### Issues to address:
1. **Data Import Failure**: Investigate why `computeStats` or `toInternalRowsFromWide` returns 0. Possible causes:
    - `standardQuestions` filter is too strict.
    - `inferCategory` fails to match Excel headers due to hidden chars or different terminology.
    - `normalize` or `normalizeKey` behavior mismatch.
2. **Dashboard Enhancement**:
    - Update "Escore Geral" card to show "Escore Bruto" vs "Escore Atenuado".
    - Add "Atenuado por: [Medidas de Controle]" detail.

## PROPOSED CHANGES

### 1. Fix Import Logic
- Relax `standardQuestions` matching or use fuzzy matching (Levenstein or common keywords).
- Ensure `inferCategory` handles common variants of the questions.
- Debug the `rows.forEach` loop in `computeStats` to log why rows are being skipped.

### 2. Dashboard UI Update (index.html)
- Modify `buildSummaryCards` to include a side-by-side or stacked display of "Bruto" and "Atenuado".
- Inject the "Atenuado por:" list dynamically based on `localStorage.getItem(CONTROL_MEASURES_STORAGE_KEY)`.

### 3. Verification
- Test with simulated data rows to ensure the 27 questions are captured.
- Verify the participation rate calculation with new metrics.

## TASK BREAKDOWN
1. [DEBUGGER] Identify the root cause of the 0.0 pts result.
2. [FRONTEND] Update the Dashboard summary cards template and logic.
3. [TEST] Run verification scripts and manual sanity checks on data processing.
