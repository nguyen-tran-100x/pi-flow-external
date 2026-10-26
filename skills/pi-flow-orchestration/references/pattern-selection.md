# Choose from the work, not a taxonomy

The [skill index](../SKILL.md) is the single task-based selector. Open the one linked pattern page that addresses your current job; do not load every pattern and every runtime reference before delegating. Its seven guides are parallel work, batch map–reduce, pipelines, routing, discover-and-delegate, independent review and bounded refinement.

## Useful distinctions

- **Separate jobs vs grouped work:** independent `external_delegate` calls often suffice. A common deliverable, many items or shared supervision can justify `external_workflow` even when the individual assignments have no dependencies.
- **Known split vs discovery:** when you already know the tasks, skip a planning child. Discover-and-delegate earns its cost only when inspection must reveal the split.
- **Different scopes vs many similar items:** use parallel work for a few distinct questions; the [batch map–reduce script](../recipes/batch-map-reduce.js) handles a collection with per-item accounting and optional synthesis.
- **Review vs refinement:** a fresh judgment need not draft, edit, vote or repeat. A bounded loop needs meaningful feedback and authorization to do the revisions.
- **Routing vs failover:** selecting a treatment for a known input is not permission to switch models/providers after failure.

## Combine only where the work calls for it

A corpus may need routing by document type, concurrent extraction, then reduction. A research task may need discovery, parallel investigation, then one independent check. Compose those parts directly in JavaScript rather than building a new coordinator for each step. The parent can perform selection and synthesis itself.

Use fresh children without parent history for independent assessments; pass selected actual evidence to dependent ones. Parallel editors need verified non-overlapping ownership or separate workspaces; Flow does not isolate working trees. Keep consequential boundaries visible, but read [runtime rules](runtime-rules.md) and [handoffs](handoffs.md) for the specific detail you need rather than treating them as a preflight ritual.

Measure useful task completion first. One well-chosen help read is better than a fast but wrong delegation.
