# dinteractions.js

A discord interactions library.

```typescript
import { Client } from 'dinteractions.js'
import {
    ApplicationCommandType
} from 'discord-api-types/v10'

const client = new Client({
    applicationId: 'DISCORD_APPLICATION_ID',
    publicKey: 'DISCORD_PUBLIC_KEY',
    token: 'DISCORD_BOT_TOKEN'
})

client.addCommand({
    command: {
        type: ApplicationCommandType.ChatInput,
        name: 'hello',
        description: 'Replies with hello message.'
    },
    handler: async (client, interaction) => {
        await client.sendReply(interaction, {
            content: 'hello'
        })
    }
})

client.syncCommands()

client.serve('/interactions', 8000)
```
