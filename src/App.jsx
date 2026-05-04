import React, { useMemo, useState } from "react";
import "./App.css";

export default function App() {
  const [itsConc, setItsConc] = useState(3);
  const [sixteenSConc, setSixteenSConc] = useState(1.5);
  const [itsLength, setItsLength] = useState(600);
  const [sixteenSLength, setSixteenSLength] = useState(1500);
  const [itsSamples, setItsSamples] = useState(6);
  const [sixteenSSamples, setSixteenSSamples] = useState(1);
  const [totalVol, setTotalVol] = useState(11);

  const clampSamples = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.min(12, Math.max(1, Math.round(number)));
  };

  const results = useMemo(() => {
    const cITS = Number(itsConc);
    const c16S = Number(sixteenSConc);
    const lITS = Number(itsLength);
    const l16S = Number(sixteenSLength);
    const nITS = Number(itsSamples);
    const n16S = Number(sixteenSSamples);
    const vTotal = Number(totalVol);

    const invalid = [cITS, c16S, lITS, l16S, nITS, n16S, vTotal].some(
      (x) => !Number.isFinite(x) || x <= 0
    );

    if (invalid) return { invalid: true };

    // Equal reads per sample:
    // molecules per pool are proportional to sample count.
    // mass is proportional to molecule count x amplicon length.
    const massRatioITSOver16S = (nITS / n16S) * (lITS / l16S);

    // Volume = mass / concentration.
    const volRatioITSOver16S = massRatioITSOver16S * (c16S / cITS);

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
      volRatioITSOver16S,
      volITS,
      vol16S,
      massITS,
      mass16S,
      balanceCheck,
    };
  }, [itsConc, sixteenSConc, itsLength, sixteenSLength, itsSamples, sixteenSSamples, totalVol]);

  const resetDefaults = () => {
    setItsConc(3);
    setSixteenSConc(1.5);
    setItsLength(600);
    setSixteenSLength(1500);
    setItsSamples(6);
    setSixteenSSamples(1);
    setTotalVol(11);
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
      [],
      ["Result", "Value", "Unit"],
      ["ITS volume", results.volITS.toFixed(3), "uL"],
      ["16S volume", results.vol16S.toFixed(3), "uL"],
      ["ITS mass", results.massITS.toFixed(3), "ng"],
      ["16S mass", results.mass16S.toFixed(3), "ng"],
      ["ITS:16S mass ratio", results.massRatioITSOver16S.toFixed(3), "ratio"],
      ["ITS:16S volume ratio", results.volRatioITSOver16S.toFixed(3), "ratio"],
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

  const NumberField = ({ label, value, onChange, unit, min = 0.001, max, step = "any" }) => (
    <label className="field">
      <span>{label}</span>
      <div className="inputRow">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(event.target.value)}
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
          The calculation accounts for amplicon length, sample count, DNA concentration, and total
          library DNA volume.
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Inputs</h2>

          <div className="twoCol">
            <NumberField label="ITS concentration" value={itsConc} onChange={setItsConc} unit="ng/uL" />
            <NumberField label="16S concentration" value={sixteenSConc} onChange={setSixteenSConc} unit="ng/uL" />
            <NumberField label="ITS amplicon length" value={itsLength} onChange={setItsLength} unit="bp" />
            <NumberField label="16S amplicon length" value={sixteenSLength} onChange={setSixteenSLength} unit="bp" />
          </div>

          <div className="twoCol">
            <NumberField
              label="ITS sample count"
              value={itsSamples}
              onChange={(value) => setItsSamples(clampSamples(value))}
              unit="1-12"
              min={1}
              max={12}
              step={1}
            />
            <NumberField
              label="16S sample count"
              value={sixteenSSamples}
              onChange={(value) => setSixteenSSamples(clampSamples(value))}
              unit="1-12"
              min={1}
              max={12}
              step={1}
            />
          </div>

          <NumberField label="Total library DNA volume" value={totalVol} onChange={setTotalVol} unit="uL" />

          <div className="buttonRow">
            <button onClick={downloadCSV} disabled={results.invalid}>Download CSV</button>
            <button className="secondary" onClick={resetDefaults}>Reset example</button>
          </div>
        </div>

        <div className="card">
          <h2>Pooling volumes</h2>

          {results.invalid ? (
            <p className="warning">Enter positive values for all concentrations, lengths, sample counts, and total volume.</p>
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
                <div><dt>ITS:16S volume ratio</dt><dd>{results.volRatioITSOver16S.toFixed(3)} : 1</dd></div>
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
          <strong>ITS volume / 16S volume = mass ratio x (16S concentration / ITS concentration)</strong>
        </p>
        <p>
          This estimates equal read depth per sample under the simplifying assumption that read count
          scales with molecule count. Nanopore length and library-prep biases may still require empirical
          adjustment after reviewing actual read distributions.
        </p>
      </section>
    </main>
  );
}
