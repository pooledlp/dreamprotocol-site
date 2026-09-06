# Customer-selected agent identity

The homepage has no fixed agent persona. An optional 40-character name field supplies the preview name and greeting. Scanner-returned names and greetings cannot overwrite the customer's choice. With no name, the greeting introduces the business without a personal name.

The existing Vapi integration receives `firstMessage` plus `variableValues.agentName` and `variableValues.assistantName`. All existing business variables and the configured assistant ID remain intact.

Before release, replace hard-coded identity statements in the hosted Vapi assistant's system prompt with `{{agentName}}`. Keep existing business rules, tools, voice settings, and restrictions. This dashboard configuration is not available in this checkout. Sending variables alone cannot replace literal names in a hosted prompt. Test a call with two different customer-selected names after that change.

The original example MP3 is retained unchanged; it is a prerecorded example, not a personalized call.

Validated locally: selected names (including accented letters and apostrophes), neutral default, ignoring scanner-provided persona, preview greeting, outgoing voice overrides, JavaScript syntax, and static asset resolution. Live calls were not tested.
