import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { describeRuntimeConfig } from "@/lib/editorial/runtime-config";

export const dynamic = "force-dynamic";

/**
 * The live runtime configuration.
 *
 * Generated from the same declaration the executors obey, so what an operator
 * reads here is what the newsroom is actually doing. Values were previously
 * spread across fifty-six environment reads with inline defaults, and the only
 * way to learn a real limit was to read the code.
 */
export default function Page() {
  const rows = describeRuntimeConfig(
    process.env as Record<string, string | undefined>,
  );

  return (
    <NewsroomPermissionGate permissions={["settings.manage", "audit.view"]}>
      <section className="runtime-config">
        <header>
          <p className="newsroom-empty__eyebrow">Runtime</p>
          <h1>How the newsroom is configured right now</h1>
          <p>
            These are the values in force. A setting shown as{" "}
            <strong>default</strong> has no override in this environment. Change
            one by setting its key as a Worker secret.
          </p>
        </header>

        <table className="runtime-config__table">
          <thead>
            <tr>
              <th scope="col">Setting</th>
              <th scope="col">Value</th>
              <th scope="col">Governs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  <code>{row.key}</code>
                </th>
                <td>
                  <strong>{row.value}</strong>
                  {row.isDefault ? <span> default</span> : null}
                </td>
                <td>{row.describes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </NewsroomPermissionGate>
  );
}
