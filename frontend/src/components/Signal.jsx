// Connection state as phone-style signal bars: the symbol people already read on their own phones.
// online = all bars, saved = one weak bar (showing saved data), offline = no bars with a cross.
export default function Signal({ state, label }) {
  return <span className={'signal signal-' + state} title={label}>
    <span className="signal-bars" aria-hidden="true"><i /><i /><i /><i /></span>
    <span className="signal-label">{label}</span>
  </span>;
}
