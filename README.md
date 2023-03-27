# dinteractions.js

A discord interactions library.

```typescript
import { Client } from 'dinteractions.js'

const client = new Client({
    applicationId: 'DISCORD_APPLICATION_ID',
    publicKey: 'DISCORD_PUBLIC_KEY',
    token: 'DISCORD_BOT_TOKEN'
})

client.addCommand({
    command: {
        name: 'hello',
        description: 'Replies with hello message.'
    },
    handle: async (client, interaction) => {
        await client.sendReply(interaction, {
            content: 'hello'
        })
    }
})

client.syncCommands()

client.serve('/interactions', 8000)
```
