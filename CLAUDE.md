<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance for the new AWS experience

This user has signed up for the new AWS experience. This experience lets you sign into AWS using a social provider and requires the following additional context.

Where this guidance conflicts with the project's own instructions, the project's instructions take precedence.

## Context

### Terminology:

- Say "project" instead of "account" — a project contains an AWS account and settings for sharing with other collaborators
- Say "team member" instead of "IAM user" — users are invited by email, not created or federated in IAM
- Say "AWS Settings" when referring to management tasks at [settings.aws.com](https://settings.aws.com/) (project management, billing, team members, spend limits). Users view their actual AWS resources in the AWS Management Console.
- Say "selected Region" when referring to the user's Region — not "home Region"
- The user has a managed IAM experience. This includes a managed service control policies (SCP) and resource control policies (RCP) that govern the use of AWS. They will still need to use IAM to create policies to let services work with each other. If there are questions about the SCPs or RCPs, go to the documentation at https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html

### Constraints:

- All projects share a single AWS Region determined by the user's contact address. Resources cannot be created in other Regions
- When developing:
  - MUST create all Regional resources in the project's assigned Region
  - You CAN create AWS WAF and Cloudwatch Logs resources in us-east-1 when there are global resources (like a global WAF instance) that require a connection to dependencies in us-east-1. You should not use these for any other reason, because resources in the selected Region will provide lower cost (due to no cross-Region traffic), increased availability (due to no cross-Region traffic), and easier manageability (due to not needing to look in another Region). When you need to do an inventory of resources, you need to look in both the selected Region and us-east-1 for Cloudwatch Logs or WAF resources.
  - MUST NOT attempt to create Lambda, API Gateway, or other Regional resources in any other Region
  - MUST direct users to confirm their Region in AWS Settings > View all projects > Overview > Additional Info > Region. If the user cannot confirm their Region, check in ~/.aws/config
  - MUST NOT use Lambda@Edge — excluded from both Lambda and CloudFront
  - MUST NOT use CloudFormation StackSets — no multi-account or multi-Region deployments
  - MUST NOT attempt cross-Region actions — no cross-Region replication for DynamoDB/S3/RDS, no multi-Region KMS keys
  - MUST NOT use Route 53 cross-Region routing — geolocation, latency-based, and failover routing policies are not available
  - CloudFront is a global service and its actions ARE allowed in `us-east-1`. A user can create a CloudFront distribution pointing to their project-region Lambda function URL or API Gateway. However, Lambda and API Gateway themselves MUST NOT be created in `us-east-1` — they must be in the project Region.
  - Reduced availability in `eu-north-1` specifically: Amazon Rekognition, Amazon Textract, Amazon Personalize, AWS App Runner are not available in that Region.
- IAM permissions for human access are managed by AWS. Don't assign roles to team members unless absolutely necessary
- The user may have a spend limit if they are on the paid plan. The limit that pauses their project if it's exceeded. If resources suddenly become inaccessible, ask if they have a spend limit configured. Only project owners can modify a spend limit.
- When developing:
  - MUST ask about spend limit status if the user reports sudden "Access Denied" errors on operations that previously worked
  - MUST direct users to check spend status in AWS Settings > Billing
  - MUST check if a user has upgraded their account to the paid plan
  - MUST ask the user if they want to clean up the successfully created resources or keep them to reduce cost
- The user sets up billing, creates spend limits, and retrieves and pays invoices in AWS Settings. The user creates budgets and optimizes their costs in the AWS Billing and Cost Management console
- Not all AWS services are available. If a service isn't working, do the following:
  1. Run the command `aws freetier get-account-plan-state`
  2. If accountPlanType": "FREE", check the [Free Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier) next,
  3. If accountPlanType": "PAID", check the [Paid Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan).
  4. If neither list shows the service, check the [Not supported for this experience list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services). The user will need to activate advanced features to access this service.
- Users can activate advanced AWS services and capabilities for their account.
- Before starting a task, check whether a relevant AWS skill is available. Load the skill with retrieve_skill and prefer its guidance over general knowledge.

### Help level

- help_level (required): LOW, MEDIUM, or HIGH. While a user is building, you MUST ask the user: "How much guidance would you like from me? Low (I only flag security risks), medium (I ask a couple of clarifying questions if something seems off), or high (I explain what I'm doing, suggest alternatives, and flag best practices)."

You CAN update this rule file to save a user's help_level.

Constraints for each level:

**LOW:**

- MUST follow all constraints in this context file
- MUST execute the user's request without modification
- MUST NOT ask clarifying questions unless the action would create a security vulnerability
- MUST NOT suggest alternatives or improvements

**MEDIUM:**

- MUST execute the user's request
- MAY ask up to two clarifying questions per task if the request has an ambiguity or a potential issue
- MUST NOT repeat a question or suggestion the user has already dismissed
- MUST NOT explain trade-offs or alternatives unless the user asks

**HIGH:**

- MUST explain what each step does and why before executing it
- MUST suggest alternatives when a better approach exists
- MUST flag best practices and explain trade-offs
- MUST still execute the user's choice if they disagree with a suggestion
<!-- END AWS Agent Toolkit rules -->

## Design Taste
*Source: Graffiti marketing website (localhost:4321) — generated by /taste*

### Tokens
- **Background**: `#0b0a08` (warm near-black), surface: `#16130e`, overlay: `rgba(11,10,8,0.94)`
- **Text**: primary `#f5efe2` (warm off-white), secondary `#a89c87` (warm taupe)
- **Accent**: `#c9a24d` (muted gold), muted: `rgba(212,175,106,0.25)`, border: `#443e33`
- **Type**: Bodoni Moda (display headings only), General Sans (body/UI), ui-monospace (code)
- **Scale**: h1 128px/500, h2 60px/500, h3 48px/500 (-1.2px tracking), body 24px/400 (max-width 672px)
- **Spacing**: 8px base. Section padding 128px top / 96px bottom. Container 1280px max, 48px side padding.
- **Radius**: 0px on all interactive elements. 4px on minor UI elements only.
- **Shadows**: None. Depth through opacity tiers and background color shifts.
- **Buttons**: 14px uppercase, 1.4px letter-spacing, 12px/32px padding, 0px radius.
- **Motion**: spatial 0.5s overshoot `cubic-bezier(0.25,1,0.5,1)`, state 0.15s standard, entrance 2.5s dramatic. Respects `prefers-reduced-motion`.

### Directives
- When choosing typography for Graffiti surfaces, always use Bodoni Moda for display headings and General Sans for body — because the serif/sans pairing signals "aesthetic product" rather than "developer tool."
- When working with the dark palette, always tint neutrals toward amber/brown — because the warm undertone prevents the cold-terminal feeling that pure darks create. Never use pure grays (`#888`, `#ccc`, `#f5f5f5`).
- When grouping content into sections, rely on 128px/96px padding and subtle background color shifts (`#0b0a08` → `#16130e`) — because on near-black surfaces, card borders and shadows create clutter, not clarity.
- When using the gold accent (`#c9a24d`), restrict it to a few key elements — because scarcity makes each gold element carry meaning. Use 25% opacity for borders/hover states.

### Anti-patterns
- Never use pure gray, true black (`#000`), or cool-tinted neutrals — every neutral must carry the warm amber/brown undertone of the `#0b0a08` base.
- Never add card containers, visible borders, or box-shadows to group content sections — trust padding and background shifts.
- Never apply border-radius to buttons, sections, or primary interactive elements — the sharp-corner identity is deliberate.
- Never saturate gold across headings, backgrounds, or large surfaces — gold at full opacity should appear on fewer than 10 elements per page.
- Never use cyan, purple, or any cool chromatic accent — the palette is warm-only by design.
