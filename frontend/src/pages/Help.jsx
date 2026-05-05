import { motion } from 'framer-motion';
import {
  HelpCircle, Target, Flame, Wallet, BookOpen, BarChart3, Shield,
  TrendingUp, Calculator, Activity, Calendar, History as HistoryIcon,
  ListChecks, Settings, RefreshCw, Trophy, Save, RotateCcw, Star,
  Download, MessageSquare, Zap, Users, Award, Eye, ArrowLeftRight,
} from 'lucide-react';

function Section({ icon: Icon, title, children, color = 'brand' }) {
  const colorMap = {
    brand: 'text-brand-400 border-brand-500/30 bg-brand-500/5',
    gold:  'text-gold-400 border-gold-500/30 bg-gold-500/5',
    info:  'text-info border-info/30 bg-info/5',
    danger:'text-danger border-danger/30 bg-danger/5',
    orange:'text-orange-400 border-orange-500/30 bg-orange-500/5',
  };
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      className={`glass-card p-5 border-l-4 ${colorMap[color]}`}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <Icon className="w-5 h-5" />
        <h2 className="font-display text-xl text-white tracking-wide">{title}</h2>
      </div>
      <div className="text-sm text-white/70 leading-relaxed space-y-3 font-heading">
        {children}
      </div>
    </motion.section>
  );
}

function Definition({ term, children }) {
  return (
    <div className="border-l-2 border-white/10 pl-3 py-1">
      <p className="font-heading font-bold text-white/90 mb-1">{term}</p>
      <div className="text-white/60 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-xs font-display text-brand-400">
        {n}
      </span>
      <div className="text-white/70 leading-relaxed pt-0.5">{children}</div>
    </div>
  );
}

function Formula({ children }) {
  return (
    <code className="block bg-dark-800 border border-white/10 rounded-md px-3 py-2 my-2 text-xs text-brand-300 font-mono">
      {children}
    </code>
  );
}

export default function Help() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle className="w-7 h-7 text-brand-400" />
          <h1 className="font-display text-4xl text-white tracking-wide leading-none">
            Centre <span className="text-gradient-neon">d'aide</span>
          </h1>
        </div>
        <p className="text-sm text-white/40 font-heading font-medium">
          Tout ce que tu dois savoir : concepts, fonctionnalités, stratégie.
        </p>
      </div>

      {/* À quoi sert cette app */}
      <Section icon={Target} title="À quoi sert l'application">
        <p>
          PronosDesFoufous analyse chaque match de football pour identifier les
          <strong className="text-white"> opportunités de pari rentables long terme</strong>.
          L'analyse combine xG saison ajusté domicile/extérieur, modèle Poisson,
          cotes des bookmakers (méthode Shin), forme récente, head-to-head,
          compositions probables et top scoreurs absents.
        </p>
        <p>
          <strong className="text-white">L'objectif n'est PAS</strong> de te faire
          parier sur tout : c'est de t'identifier les rares paris où tu as un
          avantage mathématique réel (les value bets), et de calculer la mise
          optimale (Kelly) pour profiter de cet avantage sans cramer ta bankroll.
        </p>
        <p className="text-white/50 text-xs italic">
          ⚠️ Les paris sportifs comportent un risque de perte. L'app maximise tes
          chances long terme mais la variance court terme reste inévitable. Ne
          mise jamais ce que tu ne peux pas te permettre de perdre.
        </p>
      </Section>

      {/* LES 4 CONCEPTS CLÉS */}
      <Section icon={Calculator} title="Les 4 concepts clés (à comprendre absolument)" color="gold">
        <p className="text-base text-white/85">
          Edge · ROI · Kelly · CLV — comprendre ces 4 termes c'est comprendre 90% de l'app.
        </p>

        <Definition term="🎯 EDGE — ton avantage théorique AVANT le pari">
          C'est l'écart entre la probabilité que ton modèle calcule et la probabilité
          implicite de la cote du bookmaker.
          <Formula>edge = ta vraie proba − proba implicite de la cote</Formula>
          <strong className="text-white">Exemple :</strong> Roma cote 2.00 (impl. 50%),
          notre modèle dit 60% → edge <span className="text-brand-400">+10%</span>.
          <br /><br />
          Affiché sur les cartes via le badge gold
          <span className="text-gold-400 font-bold"> "VALUE +10%"</span>.
          Si edge ≥ 5% → c'est un <strong>value bet</strong>, on parie. Sans edge → on ne parie pas.
        </Definition>

        <Definition term="📊 ROI — ton gain RÉEL mesuré APRÈS plein de paris">
          Return On Investment, le pourcentage de profit sur ce que tu as misé au total.
          <Formula>ROI = (Total gagné − Total misé) / Total misé × 100</Formula>
          <strong className="text-white">Exemple :</strong> tu mises 1000€ au total sur
          50 paris, tu récupères 1080€ → ROI <span className="text-brand-400">+8%</span>.
          <br /><br />
          Affiché dans Historique → Bankroll. C'est le constat de ta performance.
          Sur le long terme et si ton modèle marche, ROI moyen ≈ edge moyen.
        </Definition>

        <Definition term="💰 KELLY — combien miser sur chaque value bet">
          Formule qui calcule la mise optimale (% de bankroll) pour faire grossir ta
          bankroll long terme sans la cramer.
          <Formula>Kelly% = (proba × cote − 1) / (cote − 1)</Formula>
          <strong className="text-white">Exemple :</strong> Roma 60% / cote 2.00 →
          Kelly = 20%. Sur bankroll 100€ → mise <strong>20€ (Full Kelly)</strong>.
          <br /><br />
          On utilise une <strong>fraction de Kelly</strong> pour réduire la variance :
          <ul className="ml-4 mt-1 space-y-0.5 text-xs">
            <li>• 1/10 Kelly · ultra-prudent (mise 2% au lieu de 20%)</li>
            <li>• <strong className="text-brand-400">1/4 Kelly · recommandé</strong> (capte 80% de la croissance, ¼ de la variance)</li>
            <li>• 1/2 Kelly · agressif</li>
            <li>• Full Kelly · variance énorme</li>
          </ul>
          Kelly s'active <strong>uniquement</strong> sur les value bets — sans edge,
          Kelly retourne 0.
        </Definition>

        <Definition term="✅ CLV — preuve que tu bats vraiment le marché">
          Closing Line Value : compare la cote où <strong>toi</strong> as parié avec
          la cote au <strong>coup d'envoi</strong> du match.
          <Formula>CLV = (ta cote / cote au kick-off) − 1</Formula>
          <strong className="text-white">Exemple :</strong> tu paries Roma à 2.10 le
          matin, au kick-off la cote est descendue à 1.95 → CLV
          <span className="text-brand-400"> +7.7%</span>.
          <br /><br />
          <strong className="text-white">Pourquoi c'est crucial :</strong> les vrais
          parieurs avec edge battent systématiquement le marché. Sur 50+ paris, ton
          CLV moyen prouve ton edge mieux que ton ROI (qui est sujet à la variance).
          <br /><br />
          Saisis la cote au coup d'envoi dans Historique pronos → champ "Cote au
          coup d'envoi". L'app calcule le CLV et affiche un badge vert/rouge.
        </Definition>

        <div className="mt-3 p-3 rounded-lg bg-dark-800 border border-white/10 text-xs">
          <p className="font-heading font-bold text-white mb-1">Récap rapide</p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-white/40">
                <th className="text-left pb-1">Concept</th>
                <th className="text-left pb-1">Quand</th>
                <th className="text-left pb-1">Mesure</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr className="border-t border-white/5"><td className="py-1 pr-2">Edge</td><td>Avant le pari</td><td>Avantage théorique</td></tr>
              <tr className="border-t border-white/5"><td className="py-1 pr-2">Kelly</td><td>Au moment du pari</td><td>Mise optimale</td></tr>
              <tr className="border-t border-white/5"><td className="py-1 pr-2">CLV</td><td>Au coup d'envoi</td><td>Skill confirmé</td></tr>
              <tr className="border-t border-white/5"><td className="py-1 pr-2">ROI</td><td>Après N paris</td><td>Gain réel total</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Concepts secondaires */}
      <Section icon={Activity} title="Autres concepts à connaître" color="info">
        <Definition term="Cote (du bookmaker)">
          Si tu mises 10€ à cote 2.00 et tu gagnes, le bookmaker te rend 20€ (10€ de
          mise + 10€ de gain net). Une cote contient une probabilité implicite :
          <em> 1/cote × 100</em>. Cote 2.00 → 50%, cote 3.00 → 33%.
        </Definition>

        <Definition term="Marge bookmaker (~6%)">
          Sur un match, en additionnant 1/cote pour les 3 issues (1, X, 2), tu obtiens
          ~106% au lieu de 100%. Les 6% en trop = ce que le bookie garde. Parier au
          hasard te fait perdre ~6% en moyenne long terme.
        </Definition>

        <Definition term="Fair probability (méthode Shin)">
          Probabilité estimée par notre modèle après avoir retiré la marge bookie de
          façon asymétrique (méthode Shin 1992). Shin assume que les bookies sur-pricent
          les favoris (informed money) et sous-pricent les outsiders. Le résultat :
          fair prob plus précise que la simple répartition proportionnelle.
        </Definition>

        <Definition term="Confidence (indice de confiance) — sur le 1X2 uniquement">
          Score 0-100 calculé sur 6 facteurs internes :
          <ul className="ml-3 mt-1 text-xs space-y-0.5">
            <li>• Probabilité dominante du favori 1X2</li>
            <li>• Écart entre la 1ère et 2ème issue 1X2</li>
            <li>• Accord entre notre modèle Poisson et les cotes bookies</li>
            <li>• Qualité de l'overround (marge bookie faible = bookies confiants)</li>
            <li>• Forme récente du favori 1X2 (last 5)</li>
            <li>• Support H2H pour le favori 1X2</li>
          </ul>
          <strong className="text-white">⚠️ Important</strong> : la confidence porte
          UNIQUEMENT sur le 1X2. Une confidence élevée ne dit pas si BTTS / O-U / autre
          marché est probable. C'est juste "à quel point notre prédiction de qui gagne
          est solide".
        </Definition>

        <Definition term="xG (Expected Goals) — saison complète + venue-adjusted">
          Buts attendus par équipe, calculés sur la <strong className="text-white">saison
          complète</strong> (pas juste les 5 derniers matchs) et <strong className="text-white">ajustés
          domicile/extérieur</strong> : on multiplie l'attaque domicile de l'équipe
          recevant par la défense en déplacement de l'équipe visiteuse, et inverse.
          <br /><br />
          Si un top scoreur est absent du XI de départ, son équipe voit son xG réduit
          de 15% automatiquement (compositions ajustées).
        </Definition>

        <Definition term="Modèle Poisson">
          Modèle mathématique qui transforme les xG en probabilités de scores exacts.
          Affiché comme matrice colorée 6×6 sur l'onglet Analyse de chaque match,
          avec sample size saison + alertes top scoreur absent.
        </Definition>
      </Section>

      {/* Idée reçue importante */}
      <Section icon={Flame} title="⚠️ Un value bet n'est PAS un pari sûr" color="orange">
        <p className="text-base text-white/85">
          C'est le contre-sens le plus courant chez les débutants.
        </p>
        <p>
          Un <strong className="text-gold-400">value bet</strong> n'est <strong>pas</strong> un pari
          "facile" ni "le plus probable". C'est un pari où la <strong className="text-white">cote
          du bookmaker est trop généreuse</strong> par rapport à la vraie probabilité — donc un
          moyen mathématique de <strong>battre le bookmaker</strong> sur le long terme.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-dark-800 border border-white/10">
            <p className="font-heading font-bold text-white mb-1">Pari le plus probable</p>
            <p className="text-xs text-white/60">
              Ex: PSG @1.20 (83% chances). Tu vas presque toujours gagner mais le bookie le
              sait → gain net minuscule (0.20€ pour 1€ misé). Si en plus le bookie a sa marge,
              tu paies 6% de plus. <strong>Pari le plus probable mais perdant long terme.</strong>
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gold-500/10 border border-gold-500/30">
            <p className="font-heading font-bold text-gold-400 mb-1">Value bet</p>
            <p className="text-xs text-white/60">
              Ex: Match nul @4.88 (26% chances réelles vs 20% implicite). Tu vas perdre 3 fois sur
              4. Mais quand tu gagnes, tu touches 4.88× ta mise. La 4ème victoire compense
              largement les 3 pertes. <strong>Pari moins probable mais gagnant long terme.</strong>
            </p>
          </div>
        </div>

        <p className="text-sm">
          <strong className="text-white">L'idée fondamentale :</strong> tu ne paries pas sur ce
          qui va se passer (le résultat le plus probable), tu paries sur ce qui est{' '}
          <strong className="text-gold-400">mieux payé que ce que ça vaut</strong>. Le bookie a
          fait une erreur de pricing → tu l'exploites.
        </p>

        <Formula>
          Long terme : nb_victoires × (cote − 1) × mise &gt; nb_défaites × mise
        </Formula>

        <p className="text-xs text-white/50 italic">
          C'est la logique des pros (Bill Benter, Tony Bloom). Ils parient peu (1-3% des matchs),
          souvent sur des cotes 3-10, gagnent rarement, mais quand ils gagnent ça paye gros. Le
          ROI vient du <strong>volume de paris × edge moyen</strong>, pas du taux de victoire.
        </p>

        <p className="text-sm text-white/85">
          <strong>Conclusion :</strong> méfie-toi de ton intuition "ce pari paraît sûr". Les paris
          qui paraissent sûrs sont rarement rentables — le bookie les a déjà bien évalués pour
          attraper l'argent des parieurs intuitifs. Les vrais gains se cachent dans des paris
          qui paraissent contre-intuitifs.
        </p>
      </Section>

      {/* Pari principal vs Value bet */}
      <Section icon={Trophy} title="Pari principal vs Value bet (à ne pas confondre)" color="gold">
        <p>
          Sur chaque carte tu vois deux types de paris très différents :
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20">
            <p className="font-heading font-bold text-brand-400 mb-1">🎯 Pari principal</p>
            <p className="text-xs text-white/60 leading-relaxed">
              Le pari mis en avant en featured de la carte. Sélectionné par priorité :
              1) value bet 1X2 si existe, 2) favori 1X2 clair (≥50%) sans edge,
              3) value bet sur autre marché, 4) plus haute proba toutes catégories.
              <br /><br />
              <strong>Avec badge VALUE</strong> → c'est un value bet, parie.
              <strong> Sans badge</strong> → info seulement, ne parie pas.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gold-500/10 border border-gold-500/20">
            <p className="font-heading font-bold text-gold-400 mb-1">🔥 Value bets à parier</p>
            <p className="text-xs text-white/60 leading-relaxed">
              Bloc en dessous du pari principal listant tous les value bets détectés
              sur le match (≥5% edge), sauf celui choisi comme principal.
              <br /><br />
              Chaque ligne affiche la cote, le pari, l'edge, et la
              <strong> mise Kelly suggérée</strong>. C'est ici que se trouvent les
              opportunités de gain quand le pari principal n'a pas d'edge.
            </p>
          </div>
        </div>

        <p className="text-xs text-white/50 italic">
          💡 Le pari principal peut afficher "Kelly inactif · edge &lt; 5%" — c'est
          normal, ça veut dire qu'il faut regarder les value bets à parier en
          dessous, pas miser sur le principal.
        </p>
      </Section>

      {/* Détection des value bets */}
      <Section icon={Zap} title="Comment les value bets sont détectés" color="info">
        <p>
          La détection se fait par la fonction <code className="text-brand-300">detectValueBet</code>
          {' '}sur 3 marchés. Pour qu'un pari soit marqué <strong>VALUE</strong>, il
          faut que <strong>tous</strong> ces critères soient passés :
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>✅ <strong>edge ≥ 5%</strong> (notre fair prob dépasse l'implicite de 5+ points)</li>
          <li>✅ <strong>trueProb ≥ 25%</strong> (pas un outsider trop improbable)</li>
          <li>✅ <strong>cote ≥ 1.40</strong> (sinon mise quasi inutile)</li>
          <li>✅ <strong>cote ≤ 10.0</strong> (sinon variance trop forte)</li>
        </ul>
        <p>
          <strong className="text-white">Marchés analysés pour les value bets :</strong>
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• <strong>1X2</strong> (Match Winner) — 3 issues testées</li>
          <li>• <strong>BTTS</strong> (Both Teams to Score) — 2 issues</li>
          <li>• <strong>O/U 2.5</strong> (Goals Over/Under 2.5) — 2 issues</li>
        </ul>
        <p className="text-xs text-white/50">
          Les autres marchés (Asian Handicap, Buteurs, Score exact) sont affichés
          dans l'onglet Cotes mais ne sont pas analysés pour value bets — leur
          fair prob est trop complexe à calculer fiable.
        </p>
      </Section>

      {/* Modes edge */}
      <Section icon={Activity} title="Modes de sélection (3 niveaux)" color="gold">
        <p>
          Dans Historique → Bankroll, choisis le seuil edge selon ton appétit risque.
          Le mode filtre la <strong>liste Top 10 sur la home</strong> selon l'edge
          des paris du match (pari principal OU value bet secondaire).
        </p>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-dark-800 border border-white/10">
            <p className="font-heading font-bold text-white">Conservateur (edge ≥ 8%)</p>
            <p className="text-xs text-white/50">
              0-2 cartes par jour, qualité maximale. Idéal si tu débutes ou veux du calme.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gold-500/10 border border-gold-500/30">
            <p className="font-heading font-bold text-gold-400">Standard (edge ≥ 5%) · recommandé</p>
            <p className="text-xs text-white/50">
              2-5 cartes par jour, edge minimum 5% (au-dessus de la marge d'erreur du
              modèle ±3-4 points). Pour 95% des utilisateurs.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-dark-800 border border-white/10">
            <p className="font-heading font-bold text-white">Aggressif (tous les pronos)</p>
            <p className="text-xs text-white/50">
              Voit tous les pronos même sans edge. Kelly reste désactivé sur ceux-là.
              Risque : tentation de parier sur les paris sans edge → ROI dégradé.
            </p>
          </div>
        </div>
        <p className="text-xs text-white/50 italic">
          Le featured (Top Prono du jour) est <strong>toujours visible</strong> peu
          importe le mode — c'est la tête d'affiche.
        </p>
      </Section>

      {/* Workflow d'utilisation */}
      <Section icon={ListChecks} title="Workflow quotidien (8 étapes)" color="brand">
        <Step n="1">
          <strong className="text-white">Définis ta bankroll</strong> dans Historique → Bankroll.
          Tape ton capital de départ (ex: 100€) puis clique <Save className="w-3 h-3 inline mb-0.5" /> Enregistrer.
        </Step>
        <Step n="2">
          <strong className="text-white">Choisis fraction Kelly + mode edge</strong>.
          Recommandé pour démarrer : <strong>¼ Kelly + Standard</strong>.
        </Step>
        <Step n="3">
          <strong className="text-white">Va sur Accueil</strong>. Top Prono featured + liste
          des 10 meilleurs pronos triés par confidence. Sélecteur de jour
          (aujourd'hui → J+3) en haut.
        </Step>
        <Step n="4">
          <strong className="text-white">Cherche les badges gold "VALUE +X%"</strong>.
          C'est là que tu peux gagner. Si Kelly suggère une mise (ex: "Mise: 5 €"),
          c'est un pari recommandé. Regarde aussi le bloc "Value bets à parier"
          en dessous du pari principal.
        </Step>
        <Step n="5">
          <strong className="text-white">Place le pari chez ton bookie</strong> (Winamax,
          Betclic, etc.) puis reviens. Tape ta mise réelle dans "Ma mise" et la cote
          réellement obtenue dans "Ma cote", clique <Save className="w-3 h-3 inline mb-0.5" />.
        </Step>
        <Step n="6">
          <strong className="text-white">Au coup d'envoi</strong> (optionnel mais utile) :
          regarde la cote bookie au kick-off et tape-la dans "Cote au coup d'envoi"
          dans Historique pronos. L'app calcule ton CLV.
        </Step>
        <Step n="7">
          <strong className="text-white">Après le match</strong> : ouvre l'app ou clique
          <RefreshCw className="w-3 h-3 inline mb-0.5" /> "Vérifier les résultats" dans
          Bankroll. Le résultat se détecte automatiquement, ROI mis à jour.
        </Step>
        <Step n="8">
          <strong className="text-white">Vérifie ton ROI et ton CLV</strong> dans
          Historique → Bankroll. Après 50-100 paris settled tu sauras si ta
          stratégie marche. CLV positif = vrai skill.
        </Step>
      </Section>

      {/* Pages de l'app */}
      <Section icon={BookOpen} title="Les pages de l'application">
        <Definition term="🔥 Accueil">
          Top Prono featured (toujours affiché) + liste des 10 meilleurs pronos du
          jour triés par confidence. Sélecteur de jour en haut (aujourd'hui, demain,
          J+2, J+3). Chaque carte indique :
          <ul className="ml-3 mt-1 text-xs space-y-0.5">
            <li>• Équipes (avec streaks 🔥/❄️ si série de victoires/défaites)</li>
            <li>• Barre de probabilités 1X2</li>
            <li>• Pari principal avec badge VALUE si applicable</li>
            <li>• Mise Kelly suggérée (sur value bet uniquement)</li>
            <li>• Bloc "Value bets à parier" si autres marchés ont edge</li>
            <li>• Champs Ma mise + Ma cote pour saisir tes paris</li>
            <li>• Confidence 1X2 + indication si le pari principal est conseillé</li>
          </ul>
        </Definition>
        <Definition term="📅 Matchs/Pronostics">
          Tous les matchs du jour groupés par ligue. Filtres par ligue, par statut
          (en cours, terminés, à venir). Sélecteur de date pour matchs passés/futurs.
        </Definition>
        <Definition term="🏆 Ligues / 🌍 Coupe du Monde">
          Classement, top scoreurs, statistiques par ligue. Calendrier dédié World Cup.
        </Definition>
        <Definition term="📰 Actu Football">
          Flux d'actualités football (transferts, blessures, résultats).
        </Definition>
        <Definition term="📚 Historique">
          4 onglets :
          <ul className="ml-3 mt-1 text-xs space-y-0.5">
            <li><strong>Historique matchs</strong> — pronos dont le match est terminé, filtres W/L/En cours</li>
            <li><strong>Historique pronos</strong> — paris où tu as saisi une mise (avec mise, cote réelle, cote au kick-off, CLV, P&L, note)</li>
            <li><strong>Bankroll</strong> — paramètres complet (bankroll, Kelly, mode edge), stats P&L, courbe, export CSV, vérification résultats, reset</li>
            <li><strong>Équipe</strong> — recherche par nom d'équipe</li>
          </ul>
        </Definition>
        <Definition term="⭐ Favoris">
          Tes équipes et matchs favoris. Suivi rapide.
        </Definition>
        <Definition term="📊 Analytics">
          Statistiques avancées globales sur les pronostics.
        </Definition>
        <Definition term="❓ Aide">
          Cette page que tu lis maintenant.
        </Definition>
      </Section>

      {/* Page détail d'un match */}
      <Section icon={BarChart3} title="Page détail d'un match" color="info">
        <p>Quand tu cliques sur un match, 6 onglets :</p>
        <Definition term="Analyse">
          <strong className="text-white">Cotes en direct</strong> (banner rouge live si
          match en cours, mise à jour toutes les 30s) · recommandation API · pourcentages
          1X2 · Expected Goals · matrice Poisson 6×6 (avec sample size saison + alertes
          top scoreur absent) · comparaison statistiques · value bets détectés.
        </Definition>
        <Definition term="Cotes">
          Comparateur multi-bookmakers complet. Sections affichées :
          <ul className="ml-3 mt-1 text-xs space-y-0.5">
            <li>• Value bets détectés (badge VALUE)</li>
            <li>• Résultat final 1X2 (avec probas fair, Kelly%, value)</li>
            <li>• Buts Over/Under (1.5, 2.5, 3.5)</li>
            <li>• BTTS (les deux marquent)</li>
            <li>• Handicap asiatique (top 8 lignes)</li>
            <li>• Buteurs n'importe quand (top 12 joueurs)</li>
            <li>• Premier buteur (top 12)</li>
            <li>• Score exact (top 6)</li>
          </ul>
        </Definition>
        <Definition term="Statistiques">
          Tirs, possession, passes, fautes pendant ou après le match.
        </Definition>
        <Definition term="Événements">
          Buts, cartons, changements en chronologie.
        </Definition>
        <Definition term="Compositions">
          XI de départ + bancs des deux équipes.
        </Definition>
        <Definition term="Buteurs">
          Pronostics buteurs basés sur les top scoreurs et xG du match.
        </Definition>
      </Section>

      {/* Bankroll cash-flow */}
      <Section icon={Wallet} title="Bankroll en temps réel (cash-flow)">
        <p>
          La bankroll affichée reflète ta vraie position financière :
        </p>
        <Formula>Bankroll dispo = bankroll initiale + P&L réglé − mises en cours</Formula>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• Quand tu saisis une mise, elle est <strong className="text-white">déduite immédiatement</strong> de la bankroll dispo</li>
          <li>• Apparaît dans la ligne <strong>"En jeu"</strong> tant que le résultat n'est pas tombé</li>
          <li>• Si <strong>Win</strong> : bookie te rend <em>mise × cote</em> → bankroll remonte</li>
          <li>• Si <strong>Loss</strong> : rien ne bouge (déjà déduit à la mise)</li>
          <li>• Kelly utilise la bankroll <strong>dispo</strong> (pas l'initiale) pour calculer la prochaine mise — auto-protection contre la sur-mise</li>
        </ul>
        <p className="text-xs text-white/50 italic">
          La bankroll grossit ou rétrécit automatiquement après chaque pari résolu.
          Kelly recalcule sur la nouvelle base → effet boule de neige (intérêts composés).
        </p>
      </Section>

      {/* Auto-résolution */}
      <Section icon={RefreshCw} title="Auto-résolution des résultats" color="info">
        <p>
          L'app détecte automatiquement les résultats des matchs terminés pour mettre
          à jour ton ROI sans rien faire :
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• Au lancement de l'app, vérifie tous les paris non résolus des 14 derniers jours</li>
          <li>• Si match = FT/AET/PEN → marque W ou L selon le score réel</li>
          <li>• Bankroll mise à jour en cascade (P&L recalculé, courbe redessinée)</li>
          <li>• Plafond : 30 paris par session (économie quota API)</li>
          <li>• Bouton manuel <strong>"Vérifier les résultats"</strong> dans Bankroll pour forcer sans relancer l'app</li>
        </ul>
      </Section>

      {/* Streaks */}
      <Section icon={Zap} title="Détection de séries (streaks)" color="orange">
        <p>
          Sous le nom de chaque équipe sur les cartes de l'accueil, l'app affiche la
          série en cours si elle dépasse 2 résultats identiques consécutifs :
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• <strong>🔥 4 victoires de suite</strong> en orange · équipe en feu (hot streak)</li>
          <li>• <strong>❄️ 3 défaites de suite</strong> en bleu · équipe en chute (cold streak)</li>
          <li>• <strong>🟡 2 nuls de suite</strong> en gris · pattern récurrent</li>
        </ul>
        <p className="text-xs text-white/50 italic">
          Le modèle xG saison ne capture pas toujours ces dynamiques court-terme.
          Si une équipe est sur 5 victoires, elle est probablement sur-performante
          (méfiance) ou en grande forme (à confirmer avec le contexte).
        </p>
      </Section>

      {/* xG composition */}
      <Section icon={Users} title="xG ajusté par compositions" color="info">
        <p>
          Si le top scoreur de la ligue est absent du XI de départ d'une équipe (info
          fetch via /fixtures/lineups environ 1h avant le match), son équipe voit son
          xG réduit de 15% automatiquement. La matrice Poisson est recalculée.
        </p>
        <p className="text-xs text-white/50">
          Affiché en orange dans la matrice Poisson : "⚠️ PSG · top scoreur absent :
          K. Mbappé (24 buts) — xG ajusté −15%". Permet d'avoir des prédictions plus
          réalistes le jour du match.
        </p>
      </Section>

      {/* Live in-play */}
      <Section icon={Eye} title="Cotes en direct (live in-play)" color="orange">
        <p>
          Sur la page détail d'un match → onglet Analyse, quand le match est en cours
          (statut 1H/HT/2H/ET/BT/P), une <strong>bande rouge live</strong> apparaît
          avec un point pulsant et affiche les cotes 1X2 actuelles.
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• Mise à jour automatique toutes les 30 secondes</li>
          <li>• Indicateur "maj Xs" pour la fraîcheur</li>
          <li>• Probabilités implicites affichées par issue</li>
        </ul>
        <p className="text-xs text-white/50 italic">
          Utile pour spotter les value bets intra-match (ex: Over 2.5 cote qui remonte
          à 4.00 à HT 0-0 alors que le modèle dit toujours 30%).
        </p>
      </Section>

      {/* Player props & Asian Handicap */}
      <Section icon={Award} title="Marchés étendus (joueurs + handicap)">
        <p>
          Sur la page détail d'un match → onglet Cotes, en plus du 1X2/BTTS/O-U
          classiques :
        </p>
        <Definition term="Buteurs (Anytime + First Goalscorer)">
          Top 12 joueurs par marché avec leur cote et probabilité implicite. Mis en
          avant en brand color le plus probable. Pas encore de détection value bet
          sur ces marchés.
        </Definition>
        <Definition term="Handicap asiatique">
          Top 8 lignes (+0.5, -0.5, +1.5, etc.) avec cote et probabilité implicite.
          Marché très utilisé par les pros.
        </Definition>
        <p className="text-xs text-white/50 italic">
          Ces marchés sont affichés pour info et potentiel pari manuel. Kelly et
          détection value bet ne s'y appliquent pas encore — leur fair probability
          est trop complexe à calculer fiable.
        </p>
      </Section>

      {/* Journal de paris */}
      <Section icon={MessageSquare} title="Journal de paris (notes)" color="gold">
        <p>
          Sur chaque ligne d'historique, icône <MessageSquare className="w-3 h-3 inline" />
          {' '} pour ajouter une note libre :
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• <em>"Mbappé blessé donc edge plus bas"</em></li>
          <li>• <em>"Monté de mise après 5 wins consécutives"</em></li>
          <li>• <em>"Pari risqué : j'ai senti la bonne cote vs ma proba"</em></li>
        </ul>
        <p className="text-xs text-white/50">
          Les notes sont incluses dans l'export CSV. Au bout de 100 paris, les
          relire permet d'identifier tes biais.
        </p>
      </Section>

      {/* Export CSV */}
      <Section icon={Download} title="Export CSV">
        <p>
          Bouton <strong>Export CSV</strong> dans Historique → Bankroll, à côté de
          "Vérifier les résultats". Génère un fichier <code>bankroll-YYYY-MM-DD.csv</code>
          avec une ligne par pari : date, équipes, ligue, pick, cote système, cote
          réelle, cote au kick-off, mise, résultat, score final, P&L, note.
        </p>
        <p className="text-xs text-white/50">
          UTF-8 + BOM pour ouverture directe dans Excel / LibreOffice / Google
          Sheets. Utile pour faire des analyses avancées (graphiques, segmentation
          par ligue, etc.).
        </p>
      </Section>

      {/* Reset */}
      <Section icon={RotateCcw} title="Réinitialiser tes données" color="danger">
        <p>
          Dans Historique → Bankroll, tout en bas du panneau settings :
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• <strong>Reset bankroll uniquement</strong> · remet bankroll à 0€,
            Kelly à ¼, mode Standard. Garde l'historique des pronos et des paris.</li>
          <li>• <strong>Reset complet</strong> · efface aussi tout l'historique
            des pronos, mises, cotes, notes. Action irréversible.</li>
        </ul>
        <p className="text-xs text-white/50 italic">
          Confirmation demandée avant chaque reset.
        </p>
      </Section>

      {/* Discipline */}
      <Section icon={Shield} title="La règle d'or pour gagner long terme" color="brand">
        <p className="text-base text-white/85">
          🎯 <strong>Suis Kelly. Aucune exception.</strong>
        </p>
        <p>
          La discipline pèse plus que la stratégie. Les parieurs perdants ne perdent
          pas parce que leurs prédictions sont mauvaises — ils perdent parce qu'ils
          parient <em>aussi</em> sur les pronos sans edge "pour le fun".
        </p>
        <ul className="ml-3 space-y-1 text-sm">
          <li>✅ App suggère une mise Kelly → tu mises ce montant exact</li>
          <li>❌ App ne suggère rien (Kelly inactif) → tu ne mises pas, peu importe ton intuition</li>
          <li>✅ Zéro value bet aujourd'hui → tu attends demain, tu fermes l'app</li>
          <li>❌ Pas de "petit pari pour voir", pas de "je sens venir" sans edge</li>
        </ul>
        <p className="text-xs text-white/50 italic">
          Les pros parient rarement. Bill Benter, Tony Bloom, etc. ne parient que sur
          1-3% des matchs disponibles. 97% du marché est efficient — pas d'edge possible.
        </p>
      </Section>

      {/* Conseils stratégiques */}
      <Section icon={TrendingUp} title="Conseils stratégiques">
        <Definition term="Commence prudemment">
          ¼ Kelly + Mode Standard, bankroll que tu peux totalement perdre sans drame
          (50-100€). Vise 50-100 paris settled avant tirer des conclusions sur ton ROI.
        </Definition>
        <Definition term="Mesure ton ROI ET ton CLV">
          Après 50+ paris settled :
          <ul className="ml-3 mt-1 text-xs space-y-0.5">
            <li>• ROI &gt; 8% + CLV positif → ton modèle marche, peux passer ½ Kelly</li>
            <li>• ROI 3-8% + CLV positif → reste ¼ Kelly, zone normale d'edge</li>
            <li>• ROI bon mais CLV négatif → tu as eu de la chance, pas du skill</li>
            <li>• ROI &lt; 3% ou négatif → passe Conservateur ou ¹⁄₁₀ Kelly, l'edge est probablement surestimé</li>
          </ul>
        </Definition>
        <Definition term="Saisis toujours la cote réelle">
          Le marché bouge entre la suggestion app et ton placement réel chez le bookie.
          Si tu as 2.05 au lieu de 2.10 affiché, tape 2.05 dans "Ma cote".
          Sinon ton ROI calculé sera faussé.
        </Definition>
        <Definition term="Suis le CLV pour valider ton skill">
          Le CLV est la <strong>seule</strong> métrique qui distingue chance et skill court-terme.
          Sur 50 paris, un ROI peut être positif par pure chance. Mais un CLV moyen
          positif sur 50 paris est mathématiquement quasi-impossible sans edge réel.
        </Definition>
        <Definition term="Ne change jamais ta bankroll de départ en cours de route">
          Si tu commences à 100€ et tu rajoutes 50€ après 20 paris pour "booster les
          mises", l'historique de ROI devient incohérent. Soit tu redéfinis ta
          bankroll de départ avec reset, soit tu attends un palier propre.
        </Definition>
        <Definition term="Méfie-toi des hot streaks personnels">
          Quand tu enchaînes 5 victoires, ta confiance monte et tu es tenté de monter
          les mises ou parier sur des non-value bets. Kelly t'auto-protège (mises
          calibrées sur la bankroll) mais reste discipliné mentalement.
        </Definition>
        <Definition term="Note tes paris">
          Au bout de 100 paris, relire les notes te révèle des biais (ex: "je perds
          toujours quand je parie BTTS sur Premier League"). Tu peux ajuster ta
          stratégie en conséquence.
        </Definition>
      </Section>

      {/* Footer */}
      <div className="pt-4 text-center text-xs text-white/30 font-heading">
        Cette aide évolue avec l'app. Reviens régulièrement.
      </div>
    </div>
  );
}
