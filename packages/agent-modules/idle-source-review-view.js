import { escapeHtml as h } from '../shared/index.js';

const statusLabels = { NO_EARN_SOURCE: 'No captured Earn source to review.', UNAVAILABLE: 'Current Earn evidence is unavailable.', INCOMPLETE: 'Current Earn evidence is incomplete.', CHANGED: 'Reported vault conditions changed; review required.', UNCHANGED: 'Reported values match the saved source.' };
const issues = {
  INVALID_CAPTURED_SOURCE: 'The captured source identity is invalid.', SOURCE_UNAVAILABLE: 'The Earn response is unavailable.', SOURCE_STALE: 'The response or reported liquidity time is stale or invalid.', OLDER_RESPONSE: 'The response predates the saved source; no current comparison is shown.', DUPLICATE_IDENTITY: 'The response contains duplicate vault identities.', VAULT_NOT_RETURNED: 'The saved vault was not returned on this page; its closure is not established.', ASSET_CHANGED: 'The returned asset is no longer USDC.', VAULT_NOT_ACTIVE: 'The provider no longer reports this vault as active.', PROTOCOL_CHANGED: 'The reported vault protocol changed.', APY_UNKNOWN: 'The current reported APY is unknown.', APY_CHANGED: 'The reported APY changed; your scenario rate was not updated.', LIQUIDITY_UNKNOWN: 'The current liquidity amount is unknown.', LIQUIDITY_CHANGED: 'The reported USDC liquidity changed.', ZERO_LIQUIDITY: 'The provider reports zero USDC liquidity.', CAPTURED_SIZE_EXCEEDS_SHARE: 'The saved reviewable amount exceeds its liquidity-share limit at the new reported liquidity.',
};
const value = v => v === null || v === undefined ? '—' : h(v);
export function idleSourceReviewHtml(saved) {
  if (!saved.a && !saved.b) return '';
  const receipt = saved.sourceReview;
  return '<section class="idle-source-review"><h4>Review saved sources against Earn</h4><p>A dated check only. Saved scenarios stay unchanged; this is not live monitoring.</p>' +
    '<button class="idle-source-review-run" type="button"' + (saved.reviewMode === 'loading' ? ' disabled' : '') + '>' + (saved.reviewMode === 'loading' ? 'Checking saved Earn sources…' : 'CHECK SAVED EARN SOURCES') + '</button>' +
    (saved.reviewMode === 'error' ? '<p role="status">The saved source review could not be completed. Try again.</p>' : '') +
    (receipt ? '<p>Review timestamp (UTC)</p><p data-no-translate>' + h(receipt.generatedAt) + '</p>' + receipt.reviews.map(report => '<article><h5>' + (report.slot === 'a' ? 'Scenario A' : 'Scenario B') + '</h5><p>' + statusLabels[report.status] + '</p>' +
      '<dl><div><dt>Saved liquidity (USDC)</dt><dd data-no-translate>' + value(report.previous?.amountUsdc) + '</dd></div>' +
      '<div><dt>New reported liquidity (USDC)</dt><dd data-no-translate>' + value(report.current?.amountUsdc) + '</dd></div>' +
      '<div><dt>Liquidity change, new minus saved (USDC)</dt><dd data-no-translate>' + value(report.deltaLiquidityUsdc) + '</dd></div>' +
      '<div><dt>Saved reported APY (%)</dt><dd data-no-translate>' + value(report.previous?.reportedApyPct) + '</dd></div>' +
      '<div><dt>New reported APY (%)</dt><dd data-no-translate>' + value(report.current?.reportedApyPct) + '</dd></div>' +
      '<div><dt>Earn response timestamp (UTC)</dt><dd data-no-translate>' + value(report.current?.retrievedAt) + '</dd></div></dl>' +
      (report.issues.length ? '<ul>' + report.issues.map(issue => '<li>' + h(issues[issue]) + '</li>').join('') + '</ul>' : '') + '</article>').join('') +
      '<p>Underlying data freshness and withdrawals remain unverified. A response may be cached.</p><button class="idle-source-review-download" type="button">DOWNLOAD EARN SOURCE REVIEW</button>' : '') + '</section>';
}
