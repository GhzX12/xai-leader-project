import { fmt, type CampaignRow } from "@/lib/experiment";

export default function DataTable({ rows }: { rows: CampaignRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Click</th>
            <th>Impression</th>
            <th>CTR (%)</th>
            <th>Conversion</th>
            <th>CPA ($)</th>
            <th>Conv. Rate (%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.campaign}>
              <td>{r.campaign}</td>
              <td>{fmt.int(r.clicks)}</td>
              <td>{fmt.int(r.impressions)}</td>
              <td>{fmt.ctr(r.ctr)}</td>
              <td>{r.conversions}</td>
              <td>{fmt.cpa(r.cpa)}</td>
              <td>{fmt.convRate(r.convRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
