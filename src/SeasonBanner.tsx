export default function SeasonBanner({lang}:{lang:'en'|'ar'}) {
  const ar=lang==='ar';
  return <section className="season-banner" aria-label={ar?'موسم الساموراي':'Samurai season'}>
    <div className="season-banner-copy">
      <span className="season-kicker">{ar?'تاسعة · هذا الموسم':'TAS3A · THIS SEASON'}</span>
      <h2>{ar?'روح الساموراي':'The samurai spirit'}</h2>
      <p>{ar?'شجاعة. انضباط. معًا.':'Courage. Discipline. Together.'}</p>
      <span className="season-rule" aria-hidden="true"/>
    </div>
  </section>;
}
