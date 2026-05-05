import { motion } from 'framer-motion';
import {
  HelpCircle, Target, Flame, Wallet, BookOpen, BarChart3, Shield,
  TrendingUp, Calculator, Activity, Calendar, History as HistoryIcon,
  ListChecks, Settings, RefreshCw, Trophy, Save, RotateCcw, Star,
} from 'lucide-react';

function Section({ icon: Icon, title, children, color = 'brand' }) {
  const colorMap = {
    brand: 'text-brand-400 border-brand-500/30 bg-brand-500/5',
    gold:  'text-gold-400 border-gold-500/30 bg-gold-500/5',
    info:  'text-info border-info/30 bg-info/5',
    danger:'text-danger border-danger/30 bg-danger/5',
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
      <p className="text-white/60 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-xs font-display text-brand-400">
        {n}
      </span>
      <p className="text-white/70 leading-relaxed pt-0.5">{children}</p>
    </div>
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
          Tout ce que tu dois savoir sur l'application — concepts, fonctionnement, stratégie
        </p>
      </div>

      {/* À quoi sert cette app */}
      <Section icon={Target} title="À quoi sert l'application">
        <p>
          PronosDesFoufous est un outil d'analyse de paris sportifs football qui te propose
          chaque jour <strong className="text-white">les meilleurs pronostics</strong> en
          combinant statistiques, modèles mathématiques et analyse des cotes des bookmakers.
        </p>
        <p>
          L'objectif n'est pas de te faire parier sur tout, mais de te donner uniquement
          les paris où tu as un <strong className="text-white">avantage mathématique réel</strong>
          (les value bets) — ce qui est la seule façon de gagner sur le long terme.
        </p>
        <p className="text-white/50 text-xs italic">
          ⚠️ Important : aucun pari n'est garanti. L'app maximise tes chances long terme,
          mais la variance court terme est inévitable. Mise toujours uniquement ce que
          tu peux te permettre de perdre.
        </p>
      </Section>

      {/* Concepts clés */}
      <Section icon={Calculator} title="Concepts clés à comprendre" color="info">
        <Definition term="Cote (du bookmaker)">
          Si tu mises 10€ à cote 2.00 et tu gagnes, le bookmaker te rend 20€
          (10€ de mise + 10€ de gain). Une cote contient une <em>probabilité implicite</em> :
          1/cote × 100. Cote 2.00 → 50%, cote 3.00 → 33%, cote 1.50 → 67%.
        </Definition>

        <Definition term="Marge bookmaker (~6%)">
          Sur un match, si tu additionnes 1/cote pour les 3 issues (1, X, 2), tu obtiens
          ~106% au lieu de 100%. Les 6% en trop, c'est ce que le bookie garde. C'est pour
          ça que parier au hasard te fait perdre ~6% en moyenne sur le long terme.
        </Definition>

        <Definition term="Vraie probabilité">
          Probabilité estimée par notre modèle (xG saison, Poisson, forme, H2H...).
          Plus précise que ce que la cote indique seule.
        </Definition>

        <Definition term="Edge (avantage)">
          Edge = ta vraie proba − proba implicite de la cote. Si Roma cote 2.00 (impl. 50%)
          et notre modèle dit 60% → edge +10%. C'est ton avantage mathématique sur ce pari.
          <br /><br />
          <strong className="text-white">Edge positif = tu gagnes long terme. Edge nul ou négatif = tu perds.</strong>
        </Definition>

        <Definition term="Value bet">
          Un pari avec edge ≥ 5%. Le bookie a mal évalué le risque, c'est une opportunité.
          Reconnaissable par le badge gold <span className="text-gold-400 font-bold">"VALUE +X%"</span>
          sur les cartes.
        </Definition>

        <Definition term="Confidence (indice de confiance)">
          Score 0-100 calculé sur 6 facteurs internes (probabilité dominante, écart entre
          outcomes, accord modèles, qualité overround, forme récente, historique H2H).
          Mesure la <em>fiabilité technique</em> du pronostic, pas son edge.
        </Definition>

        <Definition term="xG (Expected Goals)">
          Buts attendus par équipe, calculés sur les moyennes <strong className="text-white">saison
          complète</strong> (pas juste les 5 derniers matchs). Ajusté domicile/extérieur :
          attaque domicile de Roma × défense extérieur de Fiorentina, et inverse pour l'autre xG.
        </Definition>

        <Definition term="Modèle Poisson">
          Modèle mathématique qui transforme les xG en probabilités de scores exacts.
          Affichée comme matrice colorée sur la page détail du match.
        </Definition>
      </Section>

      {/* Différence Meilleur pari vs Value bet */}
      <Section icon={Trophy} title="Meilleur pari du jour vs Value bet" color="gold">
        <p>
          Ce sont <strong className="text-white">deux concepts différents</strong> qui peuvent
          se chevaucher ou pas :
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20">
            <p className="font-heading font-bold text-brand-400 mb-1">Meilleur pari du jour</p>
            <p className="text-xs text-white/60 leading-relaxed">
              Le pronostic avec la <strong>plus haute confidence</strong>. Affiché en grand
              avec badge ★ TOP PRONO. C'est <em>la prédiction la plus fiable</em>, peu
              importe l'edge.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gold-500/10 border border-gold-500/20">
            <p className="font-heading font-bold text-gold-400 mb-1">Value bet</p>
            <p className="text-xs text-white/60 leading-relaxed">
              Un pari avec <strong>edge ≥ 5%</strong>. Affiché avec badge gold
              <span className="text-gold-400"> VALUE +X%</span>. C'est <em>une opportunité
              mathématique</em>, peu importe la fiabilité.
            </p>
          </div>
        </div>
        <p className="text-xs text-white/50 italic">
          💡 Le meilleur pari peut être un value bet, ou non. Pour gagner de l'argent long terme,
          il faut suivre les <strong>value bets</strong>, pas juste la prédiction la plus fiable.
        </p>
      </Section>

      {/* Bankroll & Kelly */}
      <Section icon={Wallet} title="Bankroll & Critère de Kelly">
        <p>
          La <strong className="text-white">bankroll</strong> est ton capital de paris.
          Tu la définis dans <em>Historique → Bankroll</em>. C'est ton point de départ
          (ex: 100€) et l'app suit son évolution dans le temps.
        </p>

        <Definition term="Critère de Kelly">
          Formule mathématique qui calcule la mise <strong>optimale</strong> sur un value bet
          pour maximiser la croissance long terme sans risquer la ruine :
          <br />
          <code className="text-xs text-brand-400">Kelly% = (proba × cote − 1) / (cote − 1)</code>
          <br />
          Sur un pari 60% / cote 2.00 → 20% de la bankroll. Mais 20% c'est risqué émotionnellement,
          d'où les <strong>fractions</strong> de Kelly.
        </Definition>

        <Definition term="Fractions de Kelly">
          <ul className="space-y-1 mt-1 text-xs">
            <li><strong>1/10 Kelly</strong> · ultra-prudent, croissance lente, variance minime</li>
            <li><strong className="text-brand-400">1/4 Kelly · recommandé</strong> · équilibre optimal entre croissance et stress</li>
            <li><strong>1/2 Kelly</strong> · agressif, drawdowns ±35% possibles</li>
            <li><strong>Full Kelly</strong> · variance énorme, peut couper la bankroll en 2</li>
          </ul>
        </Definition>

        <Definition term="Kelly s'active uniquement sur les value bets">
          Sans edge mathématique, Kelly retourne 0 (tu ne dois pas miser). Donc seuls
          les paris avec badge "VALUE +X%" génèrent une mise suggérée.
        </Definition>

        <Definition term="Bankroll dispo vs En jeu">
          Quand tu saisis une mise, le montant est immédiatement déduit de ta bankroll
          dispo et apparaît dans "En jeu" (paris en attente). Quand le résultat tombe,
          la bankroll se met à jour automatiquement (ajout du gain si win, rien si loss).
        </Definition>
      </Section>

      {/* Modes edge */}
      <Section icon={Activity} title="Modes de sélection (edge)" color="gold">
        <p>
          Dans Historique → Bankroll, tu peux choisir 3 modes qui filtrent quels pronos
          sont affichés sur la home :
        </p>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-dark-800 border border-white/10">
            <p className="font-heading font-bold text-white">Conservateur (edge ≥ 8%)</p>
            <p className="text-xs text-white/50">
              Très peu de pronos par jour mais top qualité. Idéal si tu débutes ou veux
              de la sérénité.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gold-500/10 border border-gold-500/30">
            <p className="font-heading font-bold text-gold-400">Standard (edge ≥ 5%) · recommandé</p>
            <p className="text-xs text-white/50">
              Volume modéré, edge minimum 5% (au-dessus de la marge d'erreur du modèle).
              Pour 95% des utilisateurs.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-dark-800 border border-white/10">
            <p className="font-heading font-bold text-white">Aggressif (tous les pronos)</p>
            <p className="text-xs text-white/50">
              Voit tout, y compris les paris sans edge. Kelly reste désactivé sur ceux-là.
              Pour la curiosité ou les combinés.
            </p>
          </div>
        </div>
      </Section>

      {/* Workflow d'utilisation */}
      <Section icon={ListChecks} title="Comment utiliser l'app au quotidien">
        <Step n="1">
          <strong className="text-white">Définis ta bankroll</strong> dans Historique → Bankroll.
          Tape ton capital de départ (ex: 100€) et clique <Save className="w-3 h-3 inline mb-0.5" /> Enregistrer.
        </Step>
        <Step n="2">
          <strong className="text-white">Choisis ta fraction Kelly et ton mode edge</strong>.
          Recommandé pour débuter : ¼ Kelly + Standard.
        </Step>
        <Step n="3">
          <strong className="text-white">Va sur Accueil</strong>, tu vois le Top Prono du jour
          et la liste des 10 meilleurs pronos triés par fiabilité.
        </Step>
        <Step n="4">
          <strong className="text-white">Cherche les badges gold "VALUE +X%"</strong>.
          C'est là que tu peux gagner de l'argent. Si Kelly suggère une mise (ex: "Suggérée: 5 €"),
          c'est un pari recommandé.
        </Step>
        <Step n="5">
          <strong className="text-white">Place le pari chez ton bookie</strong> (Winamax, Betclic, etc.)
          puis reviens sur l'app. Tape ta mise réelle dans "Ma mise" + ta cote réelle dans
          "Ma cote" et clique <Save className="w-3 h-3 inline mb-0.5" />.
        </Step>
        <Step n="6">
          <strong className="text-white">Après le match</strong>, ouvre l'app ou clique
          <RefreshCw className="w-3 h-3 inline mb-0.5" /> "Vérifier les résultats" dans
          Bankroll. Le résultat se détecte automatiquement et ta bankroll se met à jour.
        </Step>
        <Step n="7">
          <strong className="text-white">Vérifie ton ROI</strong> régulièrement dans
          Historique → Bankroll. Après 50-100 paris settled, tu sauras si ta stratégie marche.
        </Step>
      </Section>

      {/* Pages de l'app */}
      <Section icon={BookOpen} title="Les pages de l'application">
        <Definition term="🔥 Accueil">
          Page principale. Affiche le Meilleur prono du jour en featured + le top 10 des
          pronos restants. Sélecteur de jour (aujourd'hui, demain, J+2, J+3) en haut.
        </Definition>
        <Definition term="📅 Matchs/Pronostics">
          Tous les matchs du jour groupés par ligue. Filtres par ligue, statut (en cours,
          terminés, à venir).
        </Definition>
        <Definition term="🏆 Ligues / Coupe du Monde">
          Classement, top scoreurs, statistiques par ligue. Calendrier dédié pour la World Cup.
        </Definition>
        <Definition term="📰 Actu Football">
          Flux d'actualités football (transferts, blessures, résultats).
        </Definition>
        <Definition term="📚 Historique">
          4 onglets :
          <ul className="ml-3 mt-1 text-xs space-y-0.5">
            <li><strong>Historique matchs</strong> — pronos dont le match est terminé</li>
            <li><strong>Historique pronos</strong> — paris où tu as saisi une mise</li>
            <li><strong>Bankroll</strong> — paramètres, courbe P&L, statistiques</li>
            <li><strong>Équipe</strong> — recherche par nom d'équipe</li>
          </ul>
        </Definition>
        <Definition term="⭐ Favoris">
          Tes équipes et matchs favoris. Suivi rapide.
        </Definition>
        <Definition term="📊 Analytics">
          Statistiques avancées globales sur les pronostics.
        </Definition>
      </Section>

      {/* Page détail d'un match */}
      <Section icon={BarChart3} title="Page détail d'un match" color="info">
        <p>Quand tu cliques sur un match, tu accèdes à 6 onglets :</p>
        <Definition term="Analyse">
          Recommandation principale, pourcentages 1X2, expected goals, matrice Poisson
          (avec sample saison), comparaison statistiques, value bets détectés.
        </Definition>
        <Definition term="Cotes">
          Comparateur multi-bookmakers, cotes 1X2, Over/Under, BTTS, score exact, value bets.
          Probabilités fair calculées affichées sur chaque issue.
        </Definition>
        <Definition term="Statistiques">
          Tirs, possession, passes, fautes... pendant ou après le match.
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

      {/* Auto-résolution */}
      <Section icon={RefreshCw} title="Auto-résolution des résultats" color="info">
        <p>
          L'app détecte automatiquement les résultats des matchs terminés pour mettre à jour
          ton ROI sans rien faire :
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• Au lancement de l'app, vérifie tous les paris non résolus des 14 derniers jours</li>
          <li>• Si match = FT (Full Time) → marque W ou L selon le score réel</li>
          <li>• Bankroll mise à jour en cascade (P&L recalculé)</li>
          <li>• Plafond : 30 paris vérifiés par session pour économiser le quota API</li>
        </ul>
        <p className="text-xs text-white/50 italic">
          Si tu veux forcer une vérification sans relancer l'app, va dans Historique → Bankroll
          et clique sur "Vérifier les résultats".
        </p>
      </Section>

      {/* Reset */}
      <Section icon={RotateCcw} title="Réinitialiser tes données" color="danger">
        <p>
          Dans Historique → Bankroll, tout en bas du panneau settings, deux boutons reset :
        </p>
        <ul className="ml-3 space-y-1 text-xs">
          <li>• <strong>Reset bankroll uniquement</strong> · remet bankroll à 0€, fraction
            Kelly à ¼, mode Standard. Garde l'historique.</li>
          <li>• <strong>Reset complet</strong> · efface aussi tout l'historique des pronos
            et tes mises saisies. Action irréversible.</li>
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
          La discipline est plus importante que la stratégie elle-même. Les parieurs perdants
          ne perdent pas parce que leurs prédictions sont mauvaises — ils perdent parce qu'ils
          parient <em>aussi</em> sur les pronos sans edge "pour le fun".
        </p>
        <ul className="ml-3 space-y-1 text-sm">
          <li>✅ Si l'app suggère une mise Kelly → tu mises ce montant</li>
          <li>❌ Si l'app ne suggère rien → tu ne mises pas, peu importe ton intuition</li>
          <li>✅ Si zéro value bet aujourd'hui → tu attends demain, tu fermes l'app</li>
          <li>❌ Pas de "petit pari pour voir", pas de "je sens venir" sans edge</li>
        </ul>
        <p className="text-xs text-white/50 italic">
          Les pros parient rarement. Bill Benter, Tony Bloom, etc. ne parient que sur 1-3% des
          matchs disponibles. Le reste du marché est efficient (les bookies ne se trompent pas).
        </p>
      </Section>

      {/* Conseils stratégiques */}
      <Section icon={TrendingUp} title="Conseils stratégiques">
        <Definition term="Commence prudemment">
          ¼ Kelly + Mode Standard, bankroll que tu peux totalement perdre sans drame
          (ex: 50-100€). Vise 50-100 paris settled avant de tirer des conclusions.
        </Definition>
        <Definition term="Mesure ton ROI réel">
          Après 50+ paris settled, regarde ton ROI dans Bankroll :
          <ul className="ml-3 mt-1 text-xs space-y-0.5">
            <li>• ROI &gt; 8% → ton modèle marche, tu peux passer ½ Kelly</li>
            <li>• ROI 3-8% → reste ¼ Kelly, c'est la zone normale d'edge</li>
            <li>• ROI &lt; 3% ou négatif → passe Conservateur ou ¹⁄₁₀ Kelly, l'edge est probablement surestimé</li>
          </ul>
        </Definition>
        <Definition term="Saisis toujours la cote réelle">
          Le marché bouge entre la suggestion app et ton placement réel chez le bookie.
          Si tu as 2.05 au lieu de 2.10 affiché par l'app, tape 2.05 dans "Ma cote".
          Sinon ton ROI calculé sera faussé.
        </Definition>
        <Definition term="N'augmente pas ta bankroll mid-stratégie">
          Si tu commences à 100€ et tu rajoutes 50€ après 20 paris, l'historique de ROI
          devient incohérent. Soit tu redéfinis ta bankroll de départ (et reset l'historique
          des paris pertinents), soit tu attends d'avoir un palier propre.
        </Definition>
      </Section>

      {/* Footer */}
      <div className="pt-4 text-center text-xs text-white/30 font-heading">
        Cette aide évolue avec l'app. Reviens régulièrement.
      </div>
    </div>
  );
}
