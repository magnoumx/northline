import { NewsroomPermissionGate } from "@/components/newsroom-permission-gate";
import { readCockpit } from "@/lib/newsroom/read-cockpit";

export const dynamic = "force-dynamic";

/**
 * The operating picture.
 *
 * Answers the three questions an operator opens a dashboard to ask: is it
 * running, is anything stuck, and what has it spent. Every figure is read from
 * the database at request time.
 */
export default async function Page() {
  const cockpit = await readCockpit();

  return (
    <NewsroomPermissionGate permissions={["audit.view", "trend.manage"]}>
      <section className="cockpit">
        <header>
          <p className="newsroom-empty__eyebrow">Today</p>
          <h1>Newsroom status</h1>
        </header>

        {cockpit.alerts.length > 0 ? (
          <ul className="cockpit__alerts">
            {cockpit.alerts.map((alert) => (
              <li key={alert.message} data-severity={alert.severity}>
                {alert.message}
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="cockpit__figures">
          <div>
            <dt>Discovered</dt>
            <dd>{cockpit.today.discovered}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{cockpit.today.drafted}</dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>{cockpit.today.published}</dd>
          </div>
          <div>
            <dt>Spend</dt>
            <dd>
              ${cockpit.today.spentUsd}
              {cockpit.today.ceilingUsd !== null ? (
                <span> of ${cockpit.today.ceilingUsd}</span>
              ) : null}
            </dd>
          </div>
        </dl>

        <section>
          <h2>Systems</h2>
          <ul className="cockpit__health">
            {cockpit.health.map((system) => (
              <li key={system.name} data-state={system.state}>
                <strong>{system.name}</strong>
                <em>{system.state}</em>
                <span>{system.evidence}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Waiting</h2>
          <ul className="cockpit__queues">
            {cockpit.queues.map((queue) => (
              <li key={queue.label}>
                <strong>{queue.count}</strong>
                <span>{queue.label}</span>
                <em>{queue.meaning}</em>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </NewsroomPermissionGate>
  );
}
