import type { MailCopy } from "./types";

export const IT_COPY: MailCopy = {
  preheaders: {
    welcome: "Il tuo account è pronto. Apri la tua biblioteca su Loomkeep.",
    verifyEmail: "Conferma il tuo indirizzo email per attivare l’account.",
    invitation: "Sei invitato a unirti a questa istanza Loomkeep.",
    passwordResetLink:
      "Scegli una nuova password usando il tuo link personale.",
    passwordChanged:
      "La tua password è cambiata. Verifica di aver richiesto questa azione.",
    emailChangedOld: "L’indirizzo email di accesso del tuo account è cambiato.",
    emailChangedNew: "Questo indirizzo è ora associato al tuo account.",
    emailChangeCode:
      "Usa il tuo codice personale per confermare il nuovo indirizzo email.",
    mfaEmailCode: "Usa il tuo codice personale per completare l’accesso.",
    newsletter: "Scopri le ultime novità di Loomkeep.",
    episodeDigest:
      "Scopri le nuove uscite di ciò che segui: episodi, film e giochi.",
    quotaAlert:
      "Un fornitore si sta avvicinando al limite giornaliero di richieste.",
    jobAlert:
      "Controlla lo stato di un’attività pianificata della tua istanza.",
    reportsDigest:
      "Alcune segnalazioni attendono una decisione di moderazione.",
    newDeviceLogin:
      "Un nuovo dispositivo ha effettuato l’accesso. Verifica questa attività.",
    apiKeyExpiring: "Rinnova la tua chiave API prima della scadenza.",
    sagaSequel: "È appena stato annunciato un seguito di una saga che segui.",
    apiKeyCreated: "È stata creata una nuova chiave API sul tuo account.",
    apiKeyLeaked: "Una chiave API esposta pubblicamente è stata revocata.",
    securityAlert:
      "Una modifica di sicurezza o un tentativo di accesso riguarda il tuo account.",
    accountDeleted: "L’eliminazione del tuo account Loomkeep è confermata.",
    adminNewUser: "È stato creato un nuovo account sulla tua istanza.",
    inactivityWarning:
      "Controlla la data di eliminazione prevista e accedi per conservare l’account.",
    moderationDecision: "Leggi la decisione, i motivi e come contestarla.",
  },
  layout: {
    tagline: "La tua biblioteca culturale",
    contact: "Contattaci",
    shortContact: "Contatti",
    fallback: "Se il pulsante non funziona, copia questo link nel browser:",
    codeSafety:
      "Non condividere mai questo codice. Loomkeep non te lo chiederà mai via email o telefono.",
    unexpectedVerification:
      "Se non hai creato un account Loomkeep, ignora questa email.",
    seriesReason: "Segui questi titoli o le loro uscite su Loomkeep.",
    newsletterReason: "Sei iscritto alle novità.",
    preferences: "Preferenze",
    unsubscribe: "Annulla l’iscrizione",
    adminReason: (host) => `Amministrazione di ${host}`,
    adminLink: "Apri l’amministrazione",
    eventAt: (date) => `Data dell’evento: ${date}`,
    appealReason: "Puoi contestare questa decisione.",
    appealLink: "Contatta la moderazione",
  },
  reportsDigest: {
    subject: (count) =>
      `${count} ${count === 1 ? "segnalazione" : "segnalazioni"} in attesa di moderazione`,
    heading: "Segnalazioni in attesa di moderazione",
    sentence: (count) =>
      `${count} ${count === 1 ? "segnalazione è" : "segnalazioni sono"} in attesa di moderazione su Loomkeep.`,
    button: "Apri la coda di moderazione",
  },
  quotaAlert: {
    subject: (provider, percent) => `Quota ${provider}: ${percent}% usato oggi`,
    heading: "Quota del fornitore",
    sentence: (provider, percent, count, limit) =>
      `${provider} ha raggiunto il ${percent}% della sua quota giornaliera: ${count} chiamate su ${limit}.`,
    exhausted:
      "Le prossime chiamate potrebbero essere rifiutate fino al cambio di giorno (mezzanotte UTC).",
    button: "Apri i servizi",
  },
  jobAlert: {
    failedSubject: (job) => `Il job ${job} non è riuscito`,
    recoveredSubject: (job) => `Il job ${job} funziona di nuovo`,
    heading: "Job pianificati",
    failed: (job) => `Il job ${job} è appena fallito:`,
    recovered: (job) => `Il job ${job} funziona di nuovo.`,
    onlyOnce:
      "Non riceverai altre email per i suoi prossimi errori, solo quando tornerà a funzionare.",
    button: "Apri i job",
  },
  moderation: {
    comment: {
      measure: "la rimozione di uno dei tuoi commenti",
      subject: "Uno dei tuoi commenti è stato rimosso",
    },
    message: {
      measure: "la rimozione di uno dei tuoi messaggi",
      subject: "Uno dei tuoi messaggi è stato rimosso",
    },
    review: {
      measure: "la rimozione di una delle tue recensioni",
      subject: "Una delle tue recensioni è stata rimossa",
    },
    listRemoved: {
      measure: "l'eliminazione di una delle tue liste",
      subject: "Una delle tue liste è stata eliminata",
    },
    listEdited: {
      measure: "la modifica di una delle tue liste",
      subject: "Una delle tue liste è stata modificata",
    },
    avatar: {
      measure: "la rimozione della tua foto profilo",
      subject: "La tua foto profilo è stata rimossa",
    },
    bio: {
      measure: "la cancellazione della tua bio",
      subject: "La tua bio è stata cancellata",
    },
    displayName: {
      measure: "la modifica del tuo nome visualizzato",
      subject: "Il tuo nome visualizzato è stato modificato",
    },
    suspended: {
      measure: (until) => `la disattivazione del tuo account fino al ${until}`,
      subject: "Il tuo account Loomkeep è disattivato",
    },
    severalSubject: "Sono state prese delle misure sul tuo account Loomkeep",
    and: "e",
    account: {
      measure: "l'eliminazione del tuo account Loomkeep",
      subject: "Il tuo account Loomkeep è stato eliminato",
    },
    illegalBasis: "riteniamo questo contenuto manifestamente illecito",
    tosBasis: (clause) =>
      `questo contenuto o comportamento viola i nostri Termini di servizio (${clause})`,
    intro: (measure) =>
      `Abbiamo preso una misura di moderazione riguardante il tuo account: ${measure}.`,
    factsLabel: "Fatti considerati",
    basisLabel: "Motivazione",
    humanDecision:
      "Questa decisione è stata presa da un moderatore, non da un sistema automatico.",
    appeal:
      "Puoi contestarla rispondendo direttamente a questa email o scrivendo a contact@loomkeep.app.",
    reference: (id) => `Riferimento della decisione: ${id}`,
    decidedAt: (date) => `Decisione presa il ${date}`,
  },
  inactivity: {
    subject: "Il tuo account Loomkeep verrà eliminato per inattività",
    heading: "Eliminazione programmata del tuo account",
    intro: "Il tuo account Loomkeep è inattivo da 24 mesi.",
    policy: (date) =>
      `In base alla nostra politica di conservazione dei dati, verrà eliminato definitivamente il ${date}, a meno che tu non acceda prima di allora.`,
    text: (date) =>
      `Il tuo account Loomkeep è inattivo da 24 mesi. In base alla nostra politica di conservazione dei dati, verrà eliminato definitivamente il ${date}, a meno che tu non acceda prima di allora.\n\nPer conservarlo, basta accedere una volta:`,
    button: "Accedi",
    hint: "Basta accedere una volta per annullare l'eliminazione.",
  },
  passwordReset: {
    subject: "Reimposta la tua password Loomkeep",
    heading: "Reimposta la password",
    intro:
      "È stato richiesto un link per reimpostare la password del tuo account Loomkeep.",
    button: "Reimposta la mia password",
    expiry:
      "Questo link scade tra 1 ora. Se non l'hai richiesto tu, ignora questa email.",
  },
  passwordChanged: {
    subject: "La tua password Loomkeep è stata cambiata",
    heading: "Password cambiata",
    intro: "La password del tuo account Loomkeep è appena stata cambiata.",
    warning:
      "Se non sei stato tu, il tuo account potrebbe essere compromesso: reimposta subito la password.",
    button: "Reimposta la mia password",
    apiKeys: (count) =>
      count === 1
        ? "Il tuo account ha una chiave API attiva: resta valida dopo questo cambio. Se non hai cambiato tu la password, revocala da Impostazioni > Integrazioni."
        : `Il tuo account ha ${count} chiavi API attive: restano valide dopo questo cambio. Se non hai cambiato tu la password, revocale da Impostazioni > Integrazioni.`,
  },
  newDevice: {
    subject: "Nuovo accesso al tuo account Loomkeep",
    heading: "Nuovo accesso rilevato",
    unknownDevice: "Dispositivo sconosciuto",
    intro: (device, ip) =>
      `È appena avvenuto un accesso al tuo account Loomkeep da un dispositivo non riconosciuto: ${device}${ip}.`,
    warning:
      "Se non sei stato tu, cambia subito la password e disconnetti gli altri dispositivi da Impostazioni > Sicurezza.",
    button: "Apri le impostazioni di sicurezza",
  },
  apiKeyCreated: {
    subject: "Nuova chiave API sul tuo account Loomkeep",
    heading: "Chiave API creata",
    intro: (name) =>
      `Sul tuo account Loomkeep è appena stata creata una chiave API chiamata «${name}». Permette a uno strumento di leggere il tuo account senza la tua password.`,
    warning:
      "Se non l'hai creata tu, revocala subito da Impostazioni > Integrazioni, poi cambia la password.",
    button: "Vedi le mie chiavi API",
  },
  apiKeyExpiring: {
    subject: (name) => `La tua chiave API «${name}» scade presto`,
    heading: "Chiave API in scadenza",
    intro: (name, date) =>
      `La tua chiave API «${name}» scade il ${date}. Dopo quella data, gli strumenti che la usano non avranno più accesso al tuo account.`,
    hint: "Se la usi ancora, crea una nuova chiave e sostituiscila nei tuoi strumenti. Altrimenti non devi fare nulla.",
    button: "Gestisci le mie chiavi API",
  },
  sagaSequel: {
    subject: (title) => `Nuovo seguito annunciato: ${title}`,
    heading: "È stato annunciato un seguito",
    intro: (title, saga) =>
      `«${title}» si è appena aggiunto alla saga ${saga}, di cui hai già visto una parte.`,
    hint: "Aggiungilo alla tua libreria per ritrovarlo al momento giusto.",
    button: "Apri la scheda",
  },
  apiKeyLeaked: {
    subject: (name) => `La tua chiave API «${name}» è stata revocata`,
    heading: "Chiave API trovata in pubblico",
    intro: (name) =>
      `La tua chiave API «${name}» è stata trovata in pubblico su GitHub. L'abbiamo revocata: non dà più accesso al tuo account.`,
    foundAt: "Dove è stata trovata:",
    hint: "Rimuovila da dove è stata pubblicata, compresa la cronologia del repository, poi crea una nuova chiave per i tuoi strumenti. Se non riconosci questa chiave, cambia la password.",
    button: "Gestisci le mie chiavi API",
  },
  securityAlert: {
    subject: "Attività di sicurezza sul tuo account Loomkeep",
    heading: "La sicurezza del tuo account",
    events: {
      MFA_TOTP_ENABLED:
        "L'autenticazione a due fattori tramite app è stata attivata sul tuo account.",
      MFA_TOTP_DISABLED:
        "L'autenticazione a due fattori tramite app è stata disattivata sul tuo account.",
      MFA_EMAIL_ENABLED:
        "L'autenticazione a due fattori via email è stata attivata sul tuo account.",
      MFA_EMAIL_DISABLED:
        "L'autenticazione a due fattori via email è stata disattivata sul tuo account.",
      MFA_WEBAUTHN_ADDED:
        "Una chiave di sicurezza è stata aggiunta al tuo account.",
      MFA_WEBAUTHN_REMOVED:
        "Una chiave di sicurezza è stata rimossa dal tuo account.",
      MFA_PASSWORDLESS_ENABLED:
        "L'accesso senza password è stato attivato sul tuo account.",
      MFA_PASSWORDLESS_DISABLED:
        "L'accesso senza password è stato disattivato sul tuo account.",
      MFA_RECOVERY_CODES_REGENERATED:
        "Sono stati creati nuovi codici di recupero per il tuo account: quelli vecchi non funzionano più.",
      MFA_RECOVERY_CODE_USED:
        "Un codice di recupero è appena servito per accedere al tuo account.",
      MFA_CHALLENGE_LOCKED:
        "Qualcuno ha inserito correttamente la tua password, poi ha fallito più volte il secondo fattore. L'accesso è stato bloccato.",
    },
    hint: "Se sei stato tu, non devi fare nulla. Altrimenti cambia subito la password e controlla le impostazioni di sicurezza.",
    lockedHint:
      "Probabilmente qualcun altro conosce la tua password: cambiala subito.",
    button: "Apri le impostazioni di sicurezza",
  },
  accountDeleted: {
    subject: "Il tuo account Loomkeep è stato eliminato",
    heading: "Account eliminato",
    self: "Come hai chiesto, il tuo account Loomkeep e la tua libreria sono stati eliminati.",
    inactive:
      "Il tuo account Loomkeep non veniva usato da tre anni: come annunciato, è stato eliminato insieme alla tua libreria.",
    outro:
      "Grazie per aver usato Loomkeep. Puoi creare un nuovo account quando vuoi.",
  },
  adminNewUser: {
    subject: (name) => `Nuova iscrizione: ${name}`,
    heading: "Nuova iscrizione",
    intro: (name) => `${name} ha appena creato un account sulla tua istanza.`,
    button: "Vedi gli account",
  },
  emailChangedOld: {
    subject: "L'email del tuo account Loomkeep è cambiata",
    heading: "Indirizzo email cambiato",
    intro: (email) =>
      `L'indirizzo email del tuo account Loomkeep è stato cambiato in ${email}.`,
    warning:
      "Se non sei stato tu, il tuo account potrebbe essere compromesso: contattaci subito.",
    button: "Contattaci",
  },
  emailChangedNew: {
    subject: "Questo indirizzo è ora collegato al tuo account Loomkeep",
    heading: "Indirizzo email confermato",
    intro: (email) =>
      `Questo indirizzo è ora l'email di accesso del tuo account Loomkeep (prima era ${email}).`,
    warning:
      "Se non hai richiesto questa modifica o non riconosci questo account, contattaci subito.",
  },
  emailChangeCode: {
    subject: "Conferma il tuo nuovo indirizzo email Loomkeep",
    heading: "Conferma il tuo indirizzo email",
    intro: "Ecco il tuo codice di conferma:",
    expiry:
      "Questo codice scade tra 15 minuti. Se non l'hai richiesto tu, ignora questa email.",
  },
  mfaCode: {
    subject: "Il tuo codice di accesso Loomkeep",
    heading: "Il tuo codice di accesso",
    intro: "Ecco il tuo codice di accesso:",
    expiry:
      "Questo codice scade tra 10 minuti. Se non hai provato ad accedere, ignora questa email e controlla la tua password.",
  },
  welcome: {
    subject: "Benvenuto su Loomkeep",
    intro: (name) =>
      `Benvenuto ${name}! Il tuo account Loomkeep è stato creato.`,
    button: "Apri Loomkeep",
  },
  verifyEmail: {
    subject: "Conferma il tuo indirizzo email Loomkeep",
    heading: "Conferma il tuo indirizzo email",
    intro: "Conferma il tuo indirizzo email cliccando sul pulsante qui sotto.",
    button: "Conferma la mia email",
    expiry: "Questo link scade tra 24 ore.",
  },
  invitation: {
    subject: (inviter) =>
      inviter
        ? `${inviter} ti ha invitato su Loomkeep`
        : "Sei invitato su Loomkeep",
    heading: "Un posto ti aspetta su Loomkeep",
    intro: (inviter) =>
      `${inviter ? `${inviter} ti ha invitato` : "Sei invitato"} a unirti a Loomkeep per seguire le tue serie, film, anime, giochi, libri e album. Crea il tuo account con il pulsante qui sotto.`,
    button: "Crea il mio account",
    expiry: (date) =>
      `Questo invito è valido fino al ${date}. Se non te lo aspettavi, ignora semplicemente questa email.`,
  },
  episodeDigest: {
    today: "oggi",
    thisWeek: "negli ultimi 7 giorni",
    oneSubject: (title) => `Nuova uscita: ${title}`,
    oneIntro: (period) => `Una nuova uscita ti aspetta ${period}.`,
    severalSubject: (count, period) => `${count} nuove uscite ${period}`,
    severalIntro: (period) => `Ecco cosa è uscito ${period}.`,
    manySubject: (count, period) => `${count} uscite ${period}`,
    manyIntro: (count, period) =>
      `Un programma fitto: ${count} nuove uscite ${period}.`,
    preferences: "Gestisci le mie notifiche",
  },
  newsletter: {
    reason: "Ricevi questa email perché ti sei iscritto agli aggiornamenti.",
    preferences: "Gestisci le mie preferenze",
    unsubscribe: "Disiscriviti",
    button: "Vedi le novità",
    eyebrow: "Nuova versione",
  },
};
