import React, { useMemo, useState } from "react";
import "./App.css";

export default function App() {
  // Store inputs as strings so users can delete/retype values without the app forcing defaults mid-edit.
  const [itsConc, setItsConc] = useState("3.00");
  const [sixteenSConc, setSixteenSConc] = useState("1.50");
  const [itsLength, setItsLength] = useState("700");
  const [sixteenSLength, setSixteenSLength] = useState("1500");
  const [itsSamples, setItsSamples] = useState("4");
  const [sixteenSSamples, setSixteenSSamples] = useState("4");
  const [totalVol, setTotalVol] = useState("11");
  const [itsCorrectionFactor, setItsCorrectionFactor] = useState("1.40");

  const formatDecimalOnBlur = (value, decimals = 2) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return value;
    return number.toFixed(decimals);
  };

  const formatIntegerOnBlur = (value, min = 1, max = 12) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return String(Math.min(max, Math.max(min, Math.round(number))));
  };

  const results = useMemo(() => {
    const cITS = Number(itsConc);
    const c16S = Number(sixteenSConc);
    const lITS = Number(itsLength);
    const l16S = Number(sixteenSLength);
    const nITS = Number(itsSamples);
    const n16S = Number(sixteenSSamples);
    const vTotal = Number(totalVol);
    const correction = Number(itsCorrectionFactor);

    const invalid = [cITS, c16S, lITS, l16S, nITS, n16S, vTotal, correction].some(
      (x) => !Number.isFinite(x) || x <= 0
    );

    if (invalid) return { invalid: true };

    // Equal reads per sample:
    // molecules per pool are proportional to sample count.
    // mass is proportional to molecule count x amplicon length.
    const massRatioITSOver16S = (nITS / n16S) * (lITS / l16S);

    // Volume = mass / concentration.
    const theoreticalVolRatioITSOver16S = massRatioITSOver16S * (c16S / cITS);

    // Empirical correction lets you compensate for real Nanopore/library-prep bias.
    // Correction > 1 adds relatively more ITS than the theoretical model.
    // Correction < 1 adds relatively less ITS.
    const volRatioITSOver16S = theoreticalVolRatioITSOver16S * correction;

    const vol16S = vTotal / (1 + volRatioITSOver16S);
    const volITS = vTotal - vol16S;
    const massITS = volITS * cITS;
    const mass16S = vol16S * c16S;

    const moleculesProxyITSPerSample = massITS / lITS / nITS;
    const moleculesProxy16SPerSample = mass16S / l16S / n16S;
    const balanceCheck = moleculesProxyITSPerSample / moleculesProxy16SPerSample;

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
    };
  }, [itsConc, sixteenSConc, itsLength, sixteenSLength, itsSamples, sixteenSSamples, totalVol, itsCorrectionFactor]);

  const resetDefaults = () => {
    setItsConc("3.00");
    setSixteenSConc("1.50");
    setItsLength("700");
    setSixteenSLength("1500");
    setItsSamples("4");
    setSixteenSSamples("4");
    setTotalVol("11");
    setItsCorrectionFactor("1.40");
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
      [],
      ["Result", "Value", "Unit"],
      ["ITS volume", results.volITS.toFixed(3), "uL"],
      ["16S volume", results.vol16S.toFixed(3), "uL"],
      ["ITS mass", results.massITS.toFixed(3), "ng"],
      ["16S mass", results.mass16S.toFixed(3), "ng"],
      ["ITS:16S mass ratio", results.massRatioITSOver16S.toFixed(3), "ratio"],
      ["Theoretical ITS:16S volume ratio", results.theoreticalVolRatioITSOver16S.toFixed(3), "ratio"],
      ["Corrected ITS:16S volume ratio", results.volRatioITSOver16S.toFixed(3), "ratio"],
      ["Per-sample balance check", results.balanceCheck.toFixed(3), "target 1.000"],
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
          library DNA volume, and an optional empirical ITS correction factor.
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
                <div><dt>Per-sample balance check</dt><dd>{results.balanceCheck.toFixed(3)}</dd></div>
              </dl>
            </>
          )}
        </div>
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
          The empirical ITS correction factor then multiplies the theoretical volume ratio before the final volumes are calculated. This lets you tune the app using observed read distributions from previous runs. Based on your earlier 5 uL ITS / 6 uL 16S run, a starting correction factor around 1.4 is reasonable for this dataset.
        </p>
      </section>
    </main>
  );
}
