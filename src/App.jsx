import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "nanoporePoolingCalculatorInputs.v2";

const DEFAULT_INPUTS = {
  itsConc: "3.00",
  sixteenSConc: "1.50",
  itsLength: "700",
  sixteenSLength: "1500",
  itsSamples: "4",
  sixteenSSamples: "4",
  totalVol: "11.00",
  itsCorrectionFactor: "1.40",
  expectedTotalReads: "",
  previousRunText: "",
};

export default function App() {
  const [itsConc, setItsConc] = useState(DEFAULT_INPUTS.itsConc);
  const [sixteenSConc, setSixteenSConc] = useState(DEFAULT_INPUTS.sixteenSConc);
  const [itsLength, setItsLength] = useState(DEFAULT_INPUTS.itsLength);
  const [sixteenSLength, setSixteenSLength] = useState(DEFAULT_INPUTS.sixteenSLength);
  const [itsSamples, setItsSamples] = useState(DEFAULT_INPUTS.itsSamples);
  const [sixteenSSamples, setSixteenSSamples] = useState(DEFAULT_INPUTS.sixteenSSamples);
  const [totalVol, setTotalVol] = useState(DEFAULT_INPUTS.totalVol);
  const [itsCorrectionFactor, setItsCorrectionFactor] = useState(DEFAULT_INPUTS.itsCorrectionFactor);
  const [expectedTotalReads, setExpectedTotalReads] = useState(DEFAULT_INPUTS.expectedTotalReads);
  const [previousRunText, setPreviousRunText] = useState(DEFAULT_INPUTS.previousRunText);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setItsConc(parsed.itsConc ?? DEFAULT_INPUTS.itsConc);
      setSixteenSConc(parsed.sixteenSConc ?? DEFAULT_INPUTS.sixteenSConc);
      setItsLength(parsed.itsLength ?? DEFAULT_INPUTS.itsLength);
      setSixteenSLength(parsed.sixteenSLength ?? DEFAULT_INPUTS.sixteenSLength);
      setItsSamples(parsed.itsSamples ?? DEFAULT_INPUTS.itsSamples);
      setSixteenSSamples(parsed.sixteenSSamples ?? DEFAULT_INPUTS.sixteenSSamples);
      setTotalVol(parsed.totalVol ?? DEFAULT_INPUTS.totalVol);
      setItsCorrectionFactor(parsed.itsCorrectionFactor ?? DEFAULT_INPUTS.itsCorrectionFactor);
      setExpectedTotalReads(parsed.expectedTotalReads ?? DEFAULT_INPUTS.expectedTotalReads);
      setPreviousRunText(parsed.previousRunText ?? DEFAULT_INPUTS.previousRunText);
    } catch {
      // Ignore malformed saved data.
    }
  }, []);

  useEffect(() => {
    const inputs = {
      itsConc,
      sixteenSConc,
      itsLength,
      sixteenSLength,
      itsSamples,
      sixteenSSamples,
      totalVol,
      itsCorrectionFactor,
      expectedTotalReads,
      previousRunText,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  }, [
    itsConc,
    sixteenSConc,
    itsLength,
    sixteenSLength,
    itsSamples,
    sixteenSSamples,
    totalVol,
    itsCorrectionFactor,
    expectedTotalReads,
    previousRunText,
  ]);

  const formatDecimalOnBlur = (value, decimals = 2) => {
    if (value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return value;
    return number.toFixed(decimals);
  };

  const formatIntegerOnBlur = (value, min = 1, max = 12) => {
    if (value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return String(Math.min(max, Math.max(min, Math.round(number))));
  };

  const parseReadCounts = (text) => {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const itsReads = [];
    const sixteenSReads = [];

    rows.forEach((line) => {
      const lower = line.toLowerCase();
      const isITS = lower.includes("its");
      const is16S = lower.includes("16s") || lower.includes("sixteens") || lower.includes("16 s");
      if (!isITS && !is16S) return;

      const numbers = line.match(/\d[\d,]*/g)?.map((x) => Number(x.replace(/,/g, ""))) ?? [];
      // Skip barcode/sample identifiers and percentages by choosing the largest plausible integer in the row.
      // For typical summary tables, this captures read count rather than barcode number or percentage.
      const plausible = numbers.filter((n) => Number.isFinite(n) && n >= 100);
      if (plausible.length === 0) return;
      const readCount = Math.max(...plausible);

      if (isITS) itsReads.push(readCount);
      if (is16S) sixteenSReads.push(readCount);
    });

    const avg = (arr) => arr.reduce((sum, x) => sum + x, 0) / arr.length;

    if (itsReads.length === 0 || sixteenSReads.length === 0) {
      return { valid: false, message: "Paste rows containing ITS and 16S read counts." };
    }

    const avgITS = avg(itsReads);
    const avg16S = avg(sixteenSReads);
    const observedITSOver16S = avgITS / avg16S;
    const suggestedCorrection = Number(itsCorrectionFactor || 1) / observedITSOver16S;

    return {
      valid: true,
      itsReads,
      sixteenSReads,
      avgITS,
      avg16S,
      observedITSOver16S,
      suggestedCorrection,
    };
  };

  const calibration = useMemo(
    () => parseReadCounts(previousRunText),
    [previousRunText, itsCorrectionFactor]
  );

  const results = useMemo(() => {
    const cITS = Number(itsConc);
    const c16S = Number(sixteenSConc);
    const lITS = Number(itsLength);
    const l16S = Number(sixteenSLength);
    const nITS = Number(itsSamples);
    const n16S = Number(sixteenSSamples);
    const vTotal = Number(totalVol);
    const correction = Number(itsCorrectionFactor);
    const expectedReads = Number(expectedTotalReads);

    const invalid = [cITS, c16S, lITS, l16S, nITS, n16S, vTotal, correction].some(
      (x) => !Number.isFinite(x) || x <= 0
    );

    if (invalid) return { invalid: true };

    const massRatioITSOver16S = (nITS / n16S) * (lITS / l16S);
    const theoreticalVolRatioITSOver16S = massRatioITSOver16S * (c16S / cITS);
    const volRatioITSOver16S = theoreticalVolRatioITSOver16S * correction;

    const vol16S = vTotal / (1 + volRatioITSOver16S);
    const volITS = vTotal - vol16S;
    const massITS = volITS * cITS;
    const mass16S = vol16S * c16S;

    // Approximate fmol/uL for dsDNA: fmol/uL = ng/uL * 1,000,000 / (bp * 660)
    const fmolPerUlITS = (cITS * 1_000_000) / (lITS * 660);
    const fmolPerUl16S = (c16S * 1_000_000) / (l16S * 660);
    const fmolLoadedITS = fmolPerUlITS * volITS;
    const fmolLoaded16S = fmolPerUl16S * vol16S;
    const fmolPerSampleITS = fmolLoadedITS / nITS;
    const fmolPerSample16S = fmolLoaded16S / n16S;

    const moleculesProxyITSPerSample = massITS / lITS / nITS;
    const moleculesProxy16SPerSample = mass16S / l16S / n16S;
    const balanceCheck = moleculesProxyITSPerSample / moleculesProxy16SPerSample;

    const totalSamples = nITS + n16S;
    const hasExpectedReads = Number.isFinite(expectedReads) && expectedReads > 0;
    const predictedReadsPerSample = hasExpectedReads ? expectedReads / totalSamples : null;
    const predictedITSReadsTotal = hasExpectedReads ? predictedReadsPerSample * nITS : null;
    const predicted16SReadsTotal = hasExpectedReads ? predictedReadsPerSample * n16S : null;

    const warnings = [];
    if (volITS < 1) warnings.push("ITS volume is <1 uL; pipetting error may be substantial. Consider dilution or increasing total volume if compatible with your protocol.");
    if (vol16S < 1) warnings.push("16S volume is <1 uL; pipetting error may be substantial. Consider dilution or increasing total volume if compatible with your protocol.");
    if (cITS / c16S > 3 || c16S / cITS > 3) warnings.push("One pool concentration is >3x the other. Re-normalising or diluting the more concentrated pool may improve pipetting accuracy.");
    if (correction > 2 || correction < 0.5) warnings.push("Correction factor is far from 1.0. That may be valid, but it suggests strong empirical bias or a prior run that should be reviewed carefully.");
    if (volITS < 0.5 || vol16S < 0.5) warnings.push("At least one calculated volume is <0.5 uL. This is usually not practical to pipette accurately.");

    return {
      invalid: false,
      massRatioITSOver16S,
      theoreticalVolRatioITSOver16S,
      volRatioITSOver16S,
      volITS,
      vol16S,
      massITS,
      mass16S,
      balanceCheck,
      fmolPerUlITS,
      fmolPerUl16S,
      fmolLoadedITS,
      fmolLoaded16S,
      fmolPerSampleITS,
      fmolPerSample16S,
      hasExpectedReads,
      predictedReadsPerSample,
      predictedITSReadsTotal,
      predicted16SReadsTotal,
      totalSamples,
      warnings,
    };
  }, [itsConc, sixteenSConc, itsLength, sixteenSLength, itsSamples, sixteenSSamples, totalVol, itsCorrectionFactor, expectedTotalReads]);

  const resetDefaults = () => {
    setItsConc(DEFAULT_INPUTS.itsConc);
    setSixteenSConc(DEFAULT_INPUTS.sixteenSConc);
    setItsLength(DEFAULT_INPUTS.itsLength);
    setSixteenSLength(DEFAULT_INPUTS.sixteenSLength);
    setItsSamples(DEFAULT_INPUTS.itsSamples);
    setSixteenSSamples(DEFAULT_INPUTS.sixteenSSamples);
    setTotalVol(DEFAULT_INPUTS.totalVol);
    setItsCorrectionFactor(DEFAULT_INPUTS.itsCorrectionFactor);
    setExpectedTotalReads(DEFAULT_INPUTS.expectedTotalReads);
    setPreviousRunText(DEFAULT_INPUTS.previousRunText);
    localStorage.removeItem(STORAGE_KEY);
  };

  const applySuggestedCorrection = () => {
    if (!calibration.valid) return;
    setItsCorrectionFactor(calibration.suggestedCorrection.toFixed(2));
  };

  const downloadCSV = () => {
    if (results.invalid) return;

    const rows = [
      ["Parameter", "Value", "Unit"],
      ["ITS concentration", itsConc, "ng/uL"],
      ["16S concentration", sixteenSConc, "ng/uL"],
      ["ITS amplicon length", itsLength, "bp"],
      ["16S amplicon length", sixteenSLength, "bp"],
      ["ITS sample count", itsSamples, "samples"],
      ["16S sample count", sixteenSSamples, "samples"],
      ["Total loading volume", totalVol, "uL"],
      ["Empirical ITS correction factor", itsCorrectionFactor, "multiplier"],
      ["Expected total reads", expectedTotalReads, "reads"],
      [],
      ["Result", "Value", "Unit"],
      ["ITS volume", results.volITS.toFixed(3), "uL"],
      ["16S volume", results.vol16S.toFixed(3), "uL"],
      ["ITS mass", results.massITS.toFixed(3), "ng"],
      ["16S mass", results.mass16S.toFixed(3), "ng"],
      ["ITS fmol/uL", results.fmolPerUlITS.toFixed(3), "fmol/uL"],
      ["16S fmol/uL", results.fmolPerUl16S.toFixed(3), "fmol/uL"],
      ["ITS fmol loaded", results.fmolLoadedITS.toFixed(3), "fmol"],
      ["16S fmol loaded", results.fmolLoaded16S.toFixed(3), "fmol"],
      ["ITS fmol/sample", results.fmolPerSampleITS.toFixed(3), "fmol/sample"],
      ["16S fmol/sample", results.fmolPerSample16S.toFixed(3), "fmol/sample"],
      ["ITS:16S mass ratio", results.massRatioITSOver16S.toFixed(3), "ratio"],
      ["Theoretical ITS:16S volume ratio", results.theoreticalVolRatioITSOver16S.toFixed(3), "ratio"],
      ["Corrected ITS:16S volume ratio", results.volRatioITSOver16S.toFixed(3), "ratio"],
      ["Per-sample balance check", results.balanceCheck.toFixed(3), "target 1.000 before empirical correction"],
    ];

    const csv = rows
      .map((row) => row.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nanopore_amplicon_pooling_calculation.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const NumberField = ({
    label,
    value,
    onChange,
    unit,
    min = 0.001,
    max,
    step = "any",
    onBlur,
  }) => (
    <label className="field">
      <span>{label}</span>
      <div className="inputRow">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <em>{unit}</em>
      </div>
    </label>
  );

  return (
    <main className="page">
      <section className="hero">
        <h1>Nanopore Amplicon Pooling Calculator</h1>
        <p>
          Balance ITS and 16S amplicon pools for approximately equal sequencing depth per sample.
          The calculation accounts for amplicon length, sample count, DNA concentration, total
          library DNA volume, fmol estimates, and an optional empirical ITS correction factor.
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Inputs</h2>

          <div className="twoCol">
            <NumberField
              label="ITS concentration"
              value={itsConc}
              onChange={setItsConc}
              onBlur={() => setItsConc(formatDecimalOnBlur(itsConc, 2))}
              unit="ng/uL"
              step="0.01"
            />
            <NumberField
              label="16S concentration"
              value={sixteenSConc}
              onChange={setSixteenSConc}
              onBlur={() => setSixteenSConc(formatDecimalOnBlur(sixteenSConc, 2))}
              unit="ng/uL"
              step="0.01"
            />
            <NumberField
              label="ITS amplicon length"
              value={itsLength}
              onChange={setItsLength}
              onBlur={() => setItsLength(formatIntegerOnBlur(itsLength, 1, 100000))}
              unit="bp"
              min={1}
              step={1}
            />
            <NumberField
              label="16S amplicon length"
              value={sixteenSLength}
              onChange={setSixteenSLength}
              onBlur={() => setSixteenSLength(formatIntegerOnBlur(sixteenSLength, 1, 100000))}
              unit="bp"
              min={1}
              step={1}
            />
          </div>

          <div className="twoCol">
            <NumberField
              label="ITS sample count"
              value={itsSamples}
              onChange={setItsSamples}
              onBlur={() => setItsSamples(formatIntegerOnBlur(itsSamples, 1, 12))}
              unit="1-12"
              min={1}
              max={12}
              step={1}
            />
            <NumberField
              label="16S sample count"
              value={sixteenSSamples}
              onChange={setSixteenSSamples}
              onBlur={() => setSixteenSSamples(formatIntegerOnBlur(sixteenSSamples, 1, 12))}
              unit="1-12"
              min={1}
              max={12}
              step={1}
            />
          </div>

          <NumberField
            label="Total library DNA volume"
            value={totalVol}
            onChange={setTotalVol}
            onBlur={() => setTotalVol(formatDecimalOnBlur(totalVol, 2))}
            unit="uL"
            step="0.01"
          />

          <label className="field sliderField">
            <span>Empirical ITS correction factor</span>
            <div className="sliderTopLine">
              <strong>{Number(itsCorrectionFactor || 0).toFixed(2)}x</strong>
              <small>Suggested from your previous run: ~1.4x</small>
            </div>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.05"
              value={Number(itsCorrectionFactor) || 1}
              onChange={(event) => setItsCorrectionFactor(event.target.value)}
            />
            <div className="inputRow">
              <input
                type="number"
                inputMode="decimal"
                min="0.2"
                max="10"
                step="0.05"
                value={itsCorrectionFactor}
                onChange={(event) => setItsCorrectionFactor(event.target.value)}
                onBlur={() => setItsCorrectionFactor(formatDecimalOnBlur(itsCorrectionFactor, 2))}
              />
              <em>x</em>
            </div>
            <p className="helpText">
              Use 1.0 for the theoretical length/sample-count model. Increase above 1.0 to add relatively more ITS; decrease below 1.0 to add less ITS.
            </p>
          </label>

          <NumberField
            label="Optional expected total reads"
            value={expectedTotalReads}
            onChange={setExpectedTotalReads}
            onBlur={() => setExpectedTotalReads(formatIntegerOnBlur(expectedTotalReads, 1, 1000000000000))}
            unit="reads"
            min={1}
            step={1}
          />

          <div className="buttonRow">
            <button onClick={downloadCSV} disabled={results.invalid}>Download CSV</button>
            <button className="secondary" onClick={resetDefaults}>Reset example</button>
          </div>
        </div>

        <div className="card">
          <h2>Pooling volumes</h2>

          {results.invalid ? (
            <p className="warning">Enter positive values for all concentrations, lengths, sample counts, total volume, and correction factor.</p>
          ) : (
            <>
              <div className="resultBox">
                <span>ITS pool volume</span>
                <strong>{results.volITS.toFixed(2)} uL</strong>
              </div>

              <div className="resultBox">
                <span>16S pool volume</span>
                <strong>{results.vol16S.toFixed(2)} uL</strong>
              </div>

              <dl className="details">
                <div><dt>ITS:16S mass ratio</dt><dd>{results.massRatioITSOver16S.toFixed(3)} : 1</dd></div>
                <div><dt>Theoretical ITS:16S volume ratio</dt><dd>{results.theoreticalVolRatioITSOver16S.toFixed(3)} : 1</dd></div>
                <div><dt>Corrected ITS:16S volume ratio</dt><dd>{results.volRatioITSOver16S.toFixed(3)} : 1</dd></div>
                <div><dt>ITS mass loaded</dt><dd>{results.massITS.toFixed(2)} ng</dd></div>
                <div><dt>16S mass loaded</dt><dd>{results.mass16S.toFixed(2)} ng</dd></div>
              </dl>
            </>
          )}
        </div>
      </section>

      {!results.invalid && (
        <section className="grid secondaryGrid">
          <div className="card">
            <h2>Estimated fmol</h2>
            <dl className="details">
              <div><dt>ITS concentration</dt><dd>{results.fmolPerUlITS.toFixed(2)} fmol/uL</dd></div>
              <div><dt>16S concentration</dt><dd>{results.fmolPerUl16S.toFixed(2)} fmol/uL</dd></div>
              <div><dt>ITS loaded</dt><dd>{results.fmolLoadedITS.toFixed(2)} fmol</dd></div>
              <div><dt>16S loaded</dt><dd>{results.fmolLoaded16S.toFixed(2)} fmol</dd></div>
              <div><dt>ITS per sample</dt><dd>{results.fmolPerSampleITS.toFixed(2)} fmol/sample</dd></div>
              <div><dt>16S per sample</dt><dd>{results.fmolPerSample16S.toFixed(2)} fmol/sample</dd></div>
            </dl>
            <p className="helpText">Uses dsDNA approximation: fmol/uL = ng/uL x 1,000,000 / (bp x 660).</p>
          </div>

          <div className="card">
            <h2>Predicted reads per sample</h2>
            {results.hasExpectedReads ? (
              <>
                <div className="resultBox smallResult">
                  <span>Estimated reads per sample</span>
                  <strong>{Math.round(results.predictedReadsPerSample).toLocaleString()}</strong>
                </div>
                <dl className="details">
                  <div><dt>Total samples</dt><dd>{results.totalSamples}</dd></div>
                  <div><dt>ITS total reads</dt><dd>{Math.round(results.predictedITSReadsTotal).toLocaleString()}</dd></div>
                  <div><dt>16S total reads</dt><dd>{Math.round(results.predicted16SReadsTotal).toLocaleString()}</dd></div>
                </dl>
              </>
            ) : (
              <p className="helpText">
                Enter an expected total read count to scale the balanced design into approximate reads per sample. This does not predict flow-cell yield; it only distributes a user-supplied total read estimate across samples.
              </p>
            )}
          </div>
        </section>
      )}

      {!results.invalid && results.warnings.length > 0 && (
        <section className="card warningsCard">
          <h2>Warnings</h2>
          <ul>
            {results.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card calibrationCard">
        <h2>Auto-correction from previous read counts</h2>
        <p className="helpText">
          Paste a previous run table containing ITS and 16S rows plus read counts. The parser estimates the average reads per sample for each amplicon and suggests a new ITS correction factor. It assumes the pasted run used the currently entered correction factor.
        </p>
        <textarea
          value={previousRunText}
          onChange={(event) => setPreviousRunText(event.target.value)}
          placeholder="Example: 16S - barcode09 8733\nITS - barcode13 116640"
        />
        {previousRunText.trim() && (
          <div className="calibrationResult">
            {calibration.valid ? (
              <>
                <dl className="details">
                  <div><dt>ITS rows detected</dt><dd>{calibration.itsReads.length}</dd></div>
                  <div><dt>16S rows detected</dt><dd>{calibration.sixteenSReads.length}</dd></div>
                  <div><dt>Avg ITS reads/sample</dt><dd>{Math.round(calibration.avgITS).toLocaleString()}</dd></div>
                  <div><dt>Avg 16S reads/sample</dt><dd>{Math.round(calibration.avg16S).toLocaleString()}</dd></div>
                  <div><dt>Observed ITS:16S reads/sample</dt><dd>{calibration.observedITSOver16S.toFixed(2)} : 1</dd></div>
                  <div><dt>Suggested ITS correction factor</dt><dd>{calibration.suggestedCorrection.toFixed(2)}x</dd></div>
                </dl>
                <button onClick={applySuggestedCorrection}>Apply suggested correction</button>
              </>
            ) : (
              <p className="warning">{calibration.message}</p>
            )}
          </div>
        )}
      </section>

      <section className="card formula">
        <h2>Formula used</h2>
        <p>
          <strong>ITS mass / 16S mass = (ITS sample count / 16S sample count) x (ITS length / 16S length)</strong>
        </p>
        <p>
          <strong>Theoretical ITS volume / 16S volume = mass ratio x (16S concentration / ITS concentration)</strong>
        </p>
        <p>
          The empirical ITS correction factor multiplies the theoretical volume ratio before the final volumes are calculated. Predicted reads are shown only as a distribution of an optional user-entered expected total yield, because actual Nanopore yield depends on active pore count, run duration, library quality, loading efficiency, and other run-specific factors.
        </p>
      </section>
    </main>
  );
}
