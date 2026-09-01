```mermaid
erDiagram

        MediaType {
            MOVIE MOVIE
SERIES SERIES
ANIME ANIME
        }



        Domain {
            MEDIA MEDIA
BOOKS BOOKS
GAMES GAMES
MUSIC MUSIC
PODCASTS PODCASTS
BOARDGAMES BOARDGAMES
        }



        DigestCadence {
            DISABLED DISABLED
WEEKLY WEEKLY
DAILY DAILY
        }



        Role {
            USER USER
ADMIN ADMIN
        }



        Plan {
            FREE FREE
PREMIUM PREMIUM
        }



        EntitlementSource {
            STRIPE STRIPE
SELF_HOST_LICENSE SELF_HOST_LICENSE
FRIENDS_FAMILY FRIENDS_FAMILY
BETA_TESTER BETA_TESTER
COMPENSATION COMPENSATION
ADMIN_GRANT ADMIN_GRANT
        }



        SubscriptionProvider {
            STRIPE STRIPE
        }



        SubscriptionStatus {
            ACTIVE ACTIVE
TRIALING TRIALING
PAST_DUE PAST_DUE
CANCELED CANCELED
INCOMPLETE INCOMPLETE
UNPAID UNPAID
        }



        ProfileAccess {
            PUBLIC PUBLIC
PRIVATE PRIVATE
GHOST GHOST
        }



        VisibilityAudience {
            PUBLIC PUBLIC
FRIENDS FRIENDS
NONE NONE
        }



        VisibilityFacet {
            LIBRARY LIBRARY
ACTIVITY ACTIVITY
        }



        FollowStatus {
            PENDING PENDING
ACCEPTED ACCEPTED
        }



        ReviewTargetType {
            MEDIA MEDIA
SEASON SEASON
EPISODE EPISODE
GAME GAME
BOOK BOOK
MUSIC MUSIC
        }



        ReviewVisibility {
            FRIENDS FRIENDS
PUBLIC PUBLIC
        }



        CommentTargetType {
            MEDIA MEDIA
SEASON SEASON
EPISODE EPISODE
GAME GAME
BOOK BOOK
MUSIC MUSIC
        }



        CommentEmote {
            LIKE LIKE
LOVE LOVE
LAUGH LAUGH
WOW WOW
SAD SAD
DISLIKE DISLIKE
        }



        ReviewVoteValue {
            UP UP
DOWN DOWN
        }



        ReportTargetType {
            COMMENT COMMENT
REVIEW REVIEW
USER USER
LIST LIST
        }



        ReportCategory {
            SPAM SPAM
ILLEGAL_CONTENT ILLEGAL_CONTENT
HARASSMENT HARASSMENT
HATE_SPEECH HATE_SPEECH
SEXUAL_CONTENT SEXUAL_CONTENT
VIOLENCE VIOLENCE
MINOR_ENDANGERMENT MINOR_ENDANGERMENT
SPOILER SPOILER
IMPERSONATION IMPERSONATION
MISINFORMATION MISINFORMATION
STOLEN_CONTENT STOLEN_CONTENT
MISLEADING_REVIEW MISLEADING_REVIEW
OTHER OTHER
        }



        ReportMotif {
            SPAM_PROMOTIONAL SPAM_PROMOTIONAL
SPAM_SUSPICIOUS_LINK SPAM_SUSPICIOUS_LINK
SPAM_REPEATED SPAM_REPEATED
ILLEGAL_PIRACY_LINK ILLEGAL_PIRACY_LINK
HARASSMENT_INSULTS HARASSMENT_INSULTS
HARASSMENT_THREATS HARASSMENT_THREATS
HARASSMENT_STALKING HARASSMENT_STALKING
HARASSMENT_DOXXING HARASSMENT_DOXXING
HATE_RACISM HATE_RACISM
HATE_SEXISM_LGBTQ HATE_SEXISM_LGBTQ
HATE_OTHER HATE_OTHER
SEXUAL_EXPLICIT SEXUAL_EXPLICIT
VIOLENCE_GRAPHIC VIOLENCE_GRAPHIC
MINOR_ENDANGERMENT_CONTENT MINOR_ENDANGERMENT_CONTENT
MINOR_ENDANGERMENT_SOLICITATION MINOR_ENDANGERMENT_SOLICITATION
SPOILER_UNTAGGED SPOILER_UNTAGGED
IMPERSONATION_REAL_PERSON IMPERSONATION_REAL_PERSON
IMPERSONATION_FAKE_ACCOUNT IMPERSONATION_FAKE_ACCOUNT
MISINFORMATION_FALSE_FACT MISINFORMATION_FALSE_FACT
STOLEN_CONTENT_PLAGIARIZED STOLEN_CONTENT_PLAGIARIZED
MISLEADING_REVIEW_MANIPULATION MISLEADING_REVIEW_MANIPULATION
        }



        ListKind {
            RANKED RANKED
COLLECTION COLLECTION
        }



        ListVisibility {
            PRIVATE PRIVATE
FRIENDS FRIENDS
PUBLIC PUBLIC
        }



        ReportStatus {
            PENDING PENDING
RESOLVED RESOLVED
DISMISSED DISMISSED
        }



        ModerationMeasure {
            COMMENT_REMOVED COMMENT_REMOVED
ACCOUNT_DELETED ACCOUNT_DELETED
        }



        ModerationLegalBasis {
            ILLEGAL_CONTENT ILLEGAL_CONTENT
TOS_BREACH TOS_BREACH
        }



        CatalogSource {
            TMDB TMDB
ANILIST ANILIST
        }



        ExternalSource {
            TMDB TMDB
ANILIST ANILIST
TVDB TVDB
IMDB IMDB
        }



        EntryStatus {
            WATCHING WATCHING
COMPLETED COMPLETED
PLANNED PLANNED
DROPPED DROPPED
UP_TO_DATE UP_TO_DATE
        }



        MediaOwnershipStatus {
            NONE NONE
PHYSICAL PHYSICAL
DIGITAL DIGITAL
STREAMING STREAMING
BORROWED BORROWED
        }



        GameSource {
            IGDB IGDB
        }



        GameStatus {
            BACKLOG BACKLOG
PLAYING PLAYING
COMPLETED COMPLETED
DROPPED DROPPED
        }



        GameOwnershipStatus {
            NONE NONE
PHYSICAL PHYSICAL
DIGITAL DIGITAL
SUBSCRIPTION SUBSCRIPTION
BORROWED BORROWED
        }



        BookSource {
            OPEN_LIBRARY OPEN_LIBRARY
        }



        BookStatus {
            TO_READ TO_READ
READING READING
READ READ
DROPPED DROPPED
        }



        BookOwnershipStatus {
            NONE NONE
PHYSICAL PHYSICAL
DIGITAL DIGITAL
AUDIO AUDIO
BORROWED BORROWED
        }



        MusicSource {
            MUSICBRAINZ MUSICBRAINZ
        }



        MusicStatus {
            TO_LISTEN TO_LISTEN
LISTENED LISTENED
        }



        MusicOwnershipStatus {
            NONE NONE
PHYSICAL PHYSICAL
DIGITAL DIGITAL
STREAMING STREAMING
BORROWED BORROWED
        }



        UserTokenType {
            PASSWORD_RESET PASSWORD_RESET
EMAIL_VERIFICATION EMAIL_VERIFICATION
        }



        SecurityEventType {
            USER_REGISTERED USER_REGISTERED
USER_DELETED USER_DELETED
EMAIL_CHANGED EMAIL_CHANGED
PASSWORD_CHANGED PASSWORD_CHANGED
PASSWORD_RESET PASSWORD_RESET
LOGIN_FAILED LOGIN_FAILED
NEW_DEVICE_LOGIN NEW_DEVICE_LOGIN
        }

  "UserEntitlement" {
    Plan plan
    EntitlementSource source "❓"
    DateTime grantedAt "❓"
    DateTime expiresAt "❓"
    Json overrides
    DateTime updatedAt
    }


  "Subscription" {
    String id "🗝️"
    SubscriptionProvider provider
    String providerSubscriptionId
    SubscriptionStatus status
    DateTime currentPeriodEnd "❓"
    Boolean cancelAtPeriodEnd
    DateTime canceledAt "❓"
    DateTime createdAt
    DateTime updatedAt
    }


  "User" {
    String id "🗝️"
    String email
    String passwordHash
    String displayName
    String username
    DateTime birthDate "❓"
    Boolean allowAdultContent
    DigestCadence notifyEmail
    DigestCadence notifyPush
    String timezone
    Boolean notifyNewsletter
    DateTime newsletterOptInAt "❓"
    String newsletterUnsubscribeToken "❓"
    Boolean emailVerified
    String bio "❓"
    Bytes avatar "❓"
    String avatarMimeType "❓"
    DateTime avatarUpdatedAt "❓"
    ProfileAccess profileAccess
    ReviewVisibility defaultReviewVisibility
    ListVisibility defaultListVisibility
    Role role
    Domain enabledDomains
    String mobileNavShortcuts
    String locale
    String calendarToken "❓"
    DateTime createdAt
    DateTime updatedAt
    DateTime onboardedAt "❓"
    DateTime acceptedTermsAt "❓"
    String acceptedTermsVersion "❓"
    DateTime certifiedAgeAt "❓"
    DateTime lastActiveAt "❓"
    DateTime inactivityWarningSentAt "❓"
    Boolean mfaTotpEnabled
    String mfaTotpSecretEnc "❓"
    Boolean mfaEmailEnabled
    }


  "VisibilitySetting" {
    String id "🗝️"
    Domain domain
    VisibilityFacet facet
    VisibilityAudience audience
    }


  "Follow" {
    String id "🗝️"
    FollowStatus status
    DateTime createdAt
    DateTime updatedAt
    }


  "Block" {
    String id "🗝️"
    DateTime createdAt
    }


  "Review" {
    String id "🗝️"
    ReviewTargetType targetType
    String targetId
    Float rating
    String text "❓"
    ReviewVisibility visibility
    DateTime createdAt
    DateTime updatedAt
    }


  "ReviewVote" {
    String id "🗝️"
    ReviewVoteValue value
    DateTime createdAt
    }


  "ReviewRevision" {
    String id "🗝️"
    Float rating
    String text "❓"
    DateTime createdAt
    }


  "Comment" {
    String id "🗝️"
    CommentTargetType targetType
    String targetId
    String text "❓"
    Boolean spoilerTag
    Boolean edited
    DateTime deletedAt "❓"
    Boolean deletedByAdmin
    DateTime createdAt
    DateTime updatedAt
    }


  "CommentReaction" {
    String id "🗝️"
    CommentEmote emote
    DateTime createdAt
    }


  "Report" {
    String id "🗝️"
    ReportTargetType targetType
    String targetId
    ReportCategory category "❓"
    ReportMotif motif "❓"
    String reason "❓"
    ReportStatus status
    DateTime createdAt
    DateTime resolvedAt "❓"
    }


  "ModerationDecision" {
    String id "🗝️"
    ModerationMeasure measure
    ReportTargetType targetType
    String targetId
    String subjectEmail
    String subjectUsername
    ModerationLegalBasis legalBasis
    ReportCategory reasonCategory "❓"
    ReportMotif reasonMotif "❓"
    String reasonText
    String tosClause
    String contentSnapshot "❓"
    Boolean automated
    DateTime decidedAt
    }


  "List" {
    String id "🗝️"
    String title
    String description "❓"
    ListKind kind
    ListVisibility visibility
    DateTime createdAt
    DateTime updatedAt
    }


  "ListMember" {
    String id "🗝️"
    DateTime createdAt
    }


  "ListItem" {
    String id "🗝️"
    ReviewTargetType targetType
    String targetId
    Int position
    DateTime addedAt
    }


  "PushSubscription" {
    String id "🗝️"
    String endpoint
    String p256dh
    String auth
    String userAgent "❓"
    DateTime createdAt
    }


  "Notification" {
    String id "🗝️"
    String type
    String title
    String body "❓"
    String url "❓"
    String dedupeKey "❓"
    Json data
    DateTime createdAt
    DateTime emailDigestedAt "❓"
    DateTime pushDigestedAt "❓"
    }


  "ActivityEvent" {
    String id "🗝️"
    String type
    String domain
    String targetType
    String targetId
    String level
    Boolean homeFeed
    String title
    String imageUrl "❓"
    String href "❓"
    Json data
    DateTime createdAt
    }


  "JobRun" {
    String id "🗝️"
    String jobKey
    DateTime startedAt
    DateTime finishedAt
    String status
    String summary "❓"
    String error "❓"
    }


  "RefreshToken" {
    String id "🗝️"
    String tokenHash
    String jti
    String userAgent "❓"
    DateTime expiresAt
    DateTime lastUsedAt
    DateTime createdAt
    }


  "UserDevice" {
    String id "🗝️"
    String deviceKey
    String userAgent "❓"
    DateTime firstSeenAt
    DateTime lastSeenAt
    }


  "UserToken" {
    String id "🗝️"
    UserTokenType type
    String tokenHash
    DateTime expiresAt
    DateTime createdAt
    }


  "SecurityEvent" {
    String id "🗝️"
    SecurityEventType type
    String identifier "❓"
    String detail "❓"
    String userAgent "❓"
    DateTime createdAt
    }


  "ImportRun" {
    String id "🗝️"
    String sourceId
    Domain domain "❓"
    String status
    Int itemCount
    Boolean overwrite
    String summary "❓"
    String error "❓"
    DateTime startedAt
    DateTime finishedAt
    }


  "BackupFile" {
    String id "🗝️"
    String filename
    Int sizeBytes
    DateTime createdAt
    }


  "NewsletterSend" {
    String id "🗝️"
    String quackbackChangelogId
    String title
    Int recipientCount
    DateTime sentAt
    }


  "ApiCallCounter" {
    String id "🗝️"
    String provider
    DateTime day
    Int count
    }


  "EmailChangeRequest" {
    String id "🗝️"
    String newEmail
    String codeHash
    Int attempts
    DateTime expiresAt
    DateTime createdAt
    }


  "MfaRecoveryCode" {
    String id "🗝️"
    String codeHash
    DateTime createdAt
    }


  "MfaLoginChallenge" {
    String id "🗝️"
    Boolean totpAllowed
    Boolean emailAllowed
    String emailCodeHash "❓"
    DateTime emailCodeExpiresAt "❓"
    Int attempts
    DateTime expiresAt
    DateTime createdAt
    }


  "MediaItem" {
    String id "🗝️"
    MediaType type
    CatalogSource canonicalSource
    String title
    String posterUrl "❓"
    String backdropUrl "❓"
    String overview "❓"
    DateTime releaseDate "❓"
    String status "❓"
    String genres
    Int runtimeMin "❓"
    Boolean isAdult
    Json metadata
    DateTime lastSyncedAt
    DateTime createdAt
    DateTime updatedAt
    }


  "MediaItemTranslation" {
    String id "🗝️"
    String locale
    String title
    String overview "❓"
    String genres
    DateTime createdAt
    DateTime updatedAt
    }


  "MediaExternalId" {
    String id "🗝️"
    ExternalSource source
    String externalId
    MediaType type
    }


  "Season" {
    String id "🗝️"
    Int number
    String title "❓"
    }


  "Episode" {
    String id "🗝️"
    Int number
    String title "❓"
    DateTime airDate "❓"
    }


  "LibraryEntry" {
    String id "🗝️"
    EntryStatus status
    String notes "❓"
    Boolean favorite
    DateTime startedAt "❓"
    DateTime finishedAt "❓"
    MediaOwnershipStatus ownershipStatus
    String ownershipSource "❓"
    DateTime createdAt
    DateTime updatedAt
    }


  "MovieReplay" {
    String id "🗝️"
    DateTime finishedAt
    }


  "EpisodeWatch" {
    String id "🗝️"
    DateTime watchedAt
    }


  "GameItem" {
    String id "🗝️"
    GameSource canonicalSource
    String title
    String coverUrl "❓"
    String backdropUrl "❓"
    String overview "❓"
    DateTime releaseDate "❓"
    String genres
    String platforms
    Boolean isAdult
    Json metadata
    DateTime lastSyncedAt
    DateTime createdAt
    DateTime updatedAt
    }


  "GameExternalId" {
    String id "🗝️"
    GameSource source
    String externalId
    }


  "GameEntry" {
    String id "🗝️"
    GameStatus status
    String notes "❓"
    Boolean favorite
    Int playtimeMinutes
    DateTime startedAt "❓"
    DateTime finishedAt "❓"
    GameOwnershipStatus ownershipStatus
    String ownershipSource "❓"
    DateTime createdAt
    DateTime updatedAt
    }


  "GameReplay" {
    String id "🗝️"
    DateTime finishedAt
    }


  "BookItem" {
    String id "🗝️"
    BookSource canonicalSource
    String title
    String authors
    String coverUrl "❓"
    String overview "❓"
    DateTime releaseDate "❓"
    String genres
    Int pageCount "❓"
    Boolean isAdult
    Json metadata
    DateTime lastSyncedAt
    DateTime createdAt
    DateTime updatedAt
    }


  "BookExternalId" {
    String id "🗝️"
    BookSource source
    String externalId
    }


  "BookEntry" {
    String id "🗝️"
    BookStatus status
    String notes "❓"
    Boolean favorite
    Int currentPage
    DateTime startedAt "❓"
    DateTime finishedAt "❓"
    BookOwnershipStatus ownershipStatus
    String ownershipSource "❓"
    DateTime createdAt
    DateTime updatedAt
    }


  "BookReplay" {
    String id "🗝️"
    DateTime finishedAt
    }


  "ReadingGoal" {
    String id "🗝️"
    Int year
    Int target
    DateTime createdAt
    DateTime updatedAt
    }


  "MusicItem" {
    String id "🗝️"
    MusicSource canonicalSource
    String title
    String artists
    String coverUrl "❓"
    DateTime releaseDate "❓"
    String genres
    String albumType "❓"
    Int trackCount "❓"
    Int durationMin "❓"
    Json metadata
    DateTime lastSyncedAt
    DateTime createdAt
    DateTime updatedAt
    }


  "MusicExternalId" {
    String id "🗝️"
    MusicSource source
    String externalId
    }


  "MusicEntry" {
    String id "🗝️"
    MusicStatus status
    String notes "❓"
    Boolean favorite
    DateTime startedAt "❓"
    DateTime finishedAt "❓"
    MusicOwnershipStatus ownershipStatus
    String ownershipSource "❓"
    DateTime createdAt
    DateTime updatedAt
    }


  "XpEntry" {
    String id "🗝️"
    String reason
    String sourceType
    String sourceId
    Int amount
    DateTime createdAt
    }


  "UserScore" {
    Int xp
    DateTime updatedAt
    }

    "UserEntitlement" |o--|| "User" : "user"
    "UserEntitlement" |o--|| "Plan" : "enum:plan"
    "UserEntitlement" |o--|o "EntitlementSource" : "enum:source"
    "Subscription" }o--|| "User" : "user"
    "Subscription" |o--|| "SubscriptionProvider" : "enum:provider"
    "Subscription" |o--|| "SubscriptionStatus" : "enum:status"
    "User" |o--|| "DigestCadence" : "enum:notifyEmail"
    "User" |o--|| "DigestCadence" : "enum:notifyPush"
    "User" |o--|| "ProfileAccess" : "enum:profileAccess"
    "User" |o--|| "ReviewVisibility" : "enum:defaultReviewVisibility"
    "User" |o--|| "ListVisibility" : "enum:defaultListVisibility"
    "User" |o--|| "Role" : "enum:role"
    "User" |o--}o "Domain" : "enum:enabledDomains"
    "VisibilitySetting" |o--|| "Domain" : "enum:domain"
    "VisibilitySetting" |o--|| "VisibilityFacet" : "enum:facet"
    "VisibilitySetting" |o--|| "VisibilityAudience" : "enum:audience"
    "VisibilitySetting" }o--|| "User" : "user"
    "Follow" |o--|| "FollowStatus" : "enum:status"
    "Follow" }o--|| "User" : "follower"
    "Follow" }o--|| "User" : "followee"
    "Block" }o--|| "User" : "blocker"
    "Block" }o--|| "User" : "blocked"
    "Review" |o--|| "ReviewTargetType" : "enum:targetType"
    "Review" |o--|| "ReviewVisibility" : "enum:visibility"
    "Review" }o--|o "User" : "user"
    "ReviewVote" |o--|| "ReviewVoteValue" : "enum:value"
    "ReviewVote" }o--|| "Review" : "review"
    "ReviewVote" }o--|| "User" : "user"
    "ReviewRevision" }o--|| "Review" : "review"
    "Comment" |o--|| "CommentTargetType" : "enum:targetType"
    "Comment" }o--|o "User" : "author"
    "Comment" |o--|o "Comment" : "parent"
    "CommentReaction" |o--|| "CommentEmote" : "enum:emote"
    "CommentReaction" }o--|| "Comment" : "comment"
    "CommentReaction" }o--|| "User" : "user"
    "Report" |o--|| "ReportTargetType" : "enum:targetType"
    "Report" |o--|o "ReportCategory" : "enum:category"
    "Report" |o--|o "ReportMotif" : "enum:motif"
    "Report" |o--|| "ReportStatus" : "enum:status"
    "Report" }o--|o "User" : "reporter"
    "Report" }o--|o "User" : "resolvedBy"
    "ModerationDecision" |o--|| "ModerationMeasure" : "enum:measure"
    "ModerationDecision" |o--|| "ReportTargetType" : "enum:targetType"
    "ModerationDecision" |o--|| "ModerationLegalBasis" : "enum:legalBasis"
    "ModerationDecision" |o--|o "ReportCategory" : "enum:reasonCategory"
    "ModerationDecision" |o--|o "ReportMotif" : "enum:reasonMotif"
    "ModerationDecision" }o--|o "User" : "subject"
    "ModerationDecision" }o--|o "User" : "decidedBy"
    "ModerationDecision" }o--|o "Report" : "report"
    "List" |o--|| "ListKind" : "enum:kind"
    "List" |o--|| "ListVisibility" : "enum:visibility"
    "List" }o--|| "User" : "user"
    "ListMember" }o--|| "List" : "list"
    "ListMember" }o--|| "User" : "user"
    "ListItem" |o--|| "ReviewTargetType" : "enum:targetType"
    "ListItem" }o--|| "List" : "list"
    "PushSubscription" }o--|| "User" : "user"
    "Notification" }o--|| "User" : "user"
    "ActivityEvent" }o--|| "User" : "user"
    "RefreshToken" }o--|| "User" : "user"
    "UserDevice" }o--|| "User" : "user"
    "UserToken" |o--|| "UserTokenType" : "enum:type"
    "UserToken" }o--|| "User" : "user"
    "SecurityEvent" |o--|| "SecurityEventType" : "enum:type"
    "SecurityEvent" }o--|o "User" : "user"
    "ImportRun" |o--|o "Domain" : "enum:domain"
    "ImportRun" }o--|o "User" : "user"
    "EmailChangeRequest" }o--|| "User" : "user"
    "MfaRecoveryCode" }o--|| "User" : "user"
    "MfaLoginChallenge" }o--|| "User" : "user"
    "MediaItem" |o--|| "MediaType" : "enum:type"
    "MediaItem" |o--|| "CatalogSource" : "enum:canonicalSource"
    "MediaItemTranslation" }o--|| "MediaItem" : "mediaItem"
    "MediaExternalId" |o--|| "ExternalSource" : "enum:source"
    "MediaExternalId" |o--|| "MediaType" : "enum:type"
    "MediaExternalId" }o--|| "MediaItem" : "mediaItem"
    "Season" }o--|| "MediaItem" : "mediaItem"
    "Episode" }o--|| "Season" : "season"
    "LibraryEntry" |o--|| "EntryStatus" : "enum:status"
    "LibraryEntry" |o--|| "MediaOwnershipStatus" : "enum:ownershipStatus"
    "LibraryEntry" }o--|| "User" : "user"
    "LibraryEntry" }o--|| "MediaItem" : "mediaItem"
    "MovieReplay" }o--|| "LibraryEntry" : "libraryEntry"
    "EpisodeWatch" }o--|| "User" : "user"
    "EpisodeWatch" }o--|| "Episode" : "episode"
    "GameItem" |o--|| "GameSource" : "enum:canonicalSource"
    "GameExternalId" |o--|| "GameSource" : "enum:source"
    "GameExternalId" }o--|| "GameItem" : "gameItem"
    "GameEntry" |o--|| "GameStatus" : "enum:status"
    "GameEntry" |o--|| "GameOwnershipStatus" : "enum:ownershipStatus"
    "GameEntry" }o--|| "User" : "user"
    "GameEntry" }o--|| "GameItem" : "gameItem"
    "GameReplay" }o--|| "GameEntry" : "gameEntry"
    "BookItem" |o--|| "BookSource" : "enum:canonicalSource"
    "BookExternalId" |o--|| "BookSource" : "enum:source"
    "BookExternalId" }o--|| "BookItem" : "bookItem"
    "BookEntry" |o--|| "BookStatus" : "enum:status"
    "BookEntry" |o--|| "BookOwnershipStatus" : "enum:ownershipStatus"
    "BookEntry" }o--|| "User" : "user"
    "BookEntry" }o--|| "BookItem" : "bookItem"
    "BookReplay" }o--|| "BookEntry" : "bookEntry"
    "ReadingGoal" }o--|| "User" : "user"
    "MusicItem" |o--|| "MusicSource" : "enum:canonicalSource"
    "MusicExternalId" |o--|| "MusicSource" : "enum:source"
    "MusicExternalId" }o--|| "MusicItem" : "musicItem"
    "MusicEntry" |o--|| "MusicStatus" : "enum:status"
    "MusicEntry" |o--|| "MusicOwnershipStatus" : "enum:ownershipStatus"
    "MusicEntry" }o--|| "User" : "user"
    "MusicEntry" }o--|| "MusicItem" : "musicItem"
    "XpEntry" }o--|| "User" : "user"
    "UserScore" |o--|| "User" : "user"
```
