import {
    REST
} from '@discordjs/rest'
import {
    APIApplicationCommandInteraction,
    APIApplicationCommandAutocompleteInteraction,
    APIApplicationCommandAutocompleteResponse,
    APICommandAutocompleteInteractionResponseCallbackData,
    APIInteraction,
    APIInteractionResponse,
    APIInteractionResponseChannelMessageWithSource,
    APIInteractionResponseCallbackData,
    APIInteractionResponseDeferredChannelMessageWithSource,
    APIInteractionResponseDeferredMessageUpdate,
    APIInteractionResponsePong,
    APIInteractionResponseUpdateMessage,
    APIMessage,
    APIMessageComponentInteraction,
    APIModalInteractionResponse,
    APIModalInteractionResponseCallbackData,
    APIModalSubmitInteraction,
    ApplicationCommandType,
    InteractionResponseType,
    InteractionType,
    MessageFlags,
    RESTGetAPIApplicationCommandResult,
    RESTGetAPIApplicationCommandsResult,
    RESTGetAPIApplicationGuildCommandsResult,
    RESTGetAPIWebhookWithTokenMessageResult,
    RESTPatchAPIApplicationCommandJSONBody,
    RESTPatchAPIApplicationCommandResult,
    RESTPatchAPIApplicationGuildCommandJSONBody,
    RESTPatchAPIApplicationGuildCommandResult,
    RESTPatchAPIWebhookWithTokenMessageJSONBody,
    RESTPatchAPIWebhookWithTokenMessageResult,
    RESTPostAPIApplicationCommandsJSONBody,
    RESTPostAPIApplicationCommandsResult,
    RESTPostAPIApplicationGuildCommandsJSONBody,
    RESTPostAPIApplicationGuildCommandsResult,
    RESTPostAPIWebhookWithTokenJSONBody,
    RESTPutAPIApplicationCommandsJSONBody,
    RESTPutAPIApplicationCommandsResult,
    RESTPutAPIApplicationGuildCommandsJSONBody,
    RESTPutAPIApplicationGuildCommandsResult,
    Routes
} from 'discord-api-types/v10'
import express, {
    NextFunction,
    Request,
    Response
} from 'express'
import 'express-async-errors'
import nacl from 'tweetnacl'

export type AutocompleteHandler = (
    interaction: APIApplicationCommandAutocompleteInteraction
) => Promise<APICommandAutocompleteInteractionResponseCallbackData | undefined>

export type InteractionHandler<Interaction> = (
    client: Client,
    interaction: Interaction
) => Promise<void>

export type ClientOptions = {
    applicationId: string
    publicKey: string
    token: string
    autocompleteHandler?: AutocompleteHandler
    interactionHandler?: InteractionHandler<APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction>
}

export type Command = {
    data: RESTPostAPIApplicationCommandsJSONBody
    handler?: InteractionHandler<APIApplicationCommandInteraction>
    autocompleteHandler?: AutocompleteHandler
}

export type GuildCommand = {
    data: RESTPostAPIApplicationGuildCommandsJSONBody
    handler?: InteractionHandler<APIApplicationCommandInteraction>
    autocompleteHandler?: AutocompleteHandler
}

type Commands<Command> = Map<ApplicationCommandType, Map<string, Command>>

export class Client {
    private readonly applicationId: string
    private readonly publicKey: string
    private readonly rest: REST
    private readonly commands: Commands<Command>
    private readonly guildCommands: Map<string, Commands<GuildCommand>>
    private readonly autocompleteHandler: AutocompleteHandler
    private readonly interactionHandler: InteractionHandler<APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction>

    get handlers() {
        return [this.verify(), this.handleInteraction()]
    }

    constructor(options: ClientOptions) {
        this.applicationId = options.applicationId
        this.publicKey = options.publicKey
        this.rest = new REST({ version: '10' }).setToken(options.token)
        this.commands = new Map()
        this.guildCommands = new Map()
        this.autocompleteHandler = options.autocompleteHandler ?? (async _ => undefined)
        this.interactionHandler = options.interactionHandler ?? (async (_c, _i) => {})
    }

    async ping() {
        const start = Date.now()
        await this.rest.get(Routes.gateway())
        return Date.now() - start
    }

    private static _addCommand<C extends Command | GuildCommand>(commands: Commands<C>, command: C) {
        const type = command.data.type ?? ApplicationCommandType.ChatInput
        const typedCommands = commands.get(type)
        if (typedCommands) {
            typedCommands.set(command.data.name, command)
        } else {
            commands.set(type, new Map().set(command.data.name, command))
        }
        return commands
    }

    addCommand(command: Command) {
        Client._addCommand(this.commands, command)
    }

    addGuildCommand(guildId: string, command: GuildCommand) {
        const commands = this.guildCommands.get(guildId)
        if (commands) {
            Client._addCommand(commands, command)
        } else {
            this.guildCommands.set(guildId, Client._addCommand(new Map(), command))
        }
    }

    async fetchCommands(withLocalizations?: boolean) {
        const query = (withLocalizations !== undefined)
            ? new URLSearchParams({with_localizations: withLocalizations ? 'true' : 'false'})
            : undefined
        return await this.rest.get(
            Routes.applicationCommands(this.applicationId),
            { query }
        ) as RESTGetAPIApplicationCommandsResult
    }

    async fetchGuildCommands(guildId: string, withLocalizations?: boolean) {
        const query = (withLocalizations !== undefined)
            ? new URLSearchParams({with_localizations: withLocalizations ? 'true' : 'false'})
            : undefined
        return await this.rest.get(
            Routes.applicationGuildCommands(this.applicationId, guildId),
            { query }
        ) as RESTGetAPIApplicationGuildCommandsResult
    }

    async registerCommand(command: RESTPostAPIApplicationCommandsJSONBody) {
        return await this.rest.post(
            Routes.applicationCommands(this.applicationId),
            { body: command }
        ) as RESTPostAPIApplicationCommandsResult
    }

    async registerGuildCommand(guildId: string, command: RESTPostAPIApplicationGuildCommandsJSONBody) {
        return await this.rest.post(
            Routes.applicationGuildCommands(this.applicationId, guildId),
            { body: command }
        ) as RESTPostAPIApplicationGuildCommandsResult
    }

    async fetchCommand(commandId: string) {
        return await this.rest.get(
            Routes.applicationCommand(this.applicationId, commandId)
        ) as RESTGetAPIApplicationCommandResult
    }

    async fetchGuildCommand(guildId: string, commandId: string) {
        return await this.rest.get(
            Routes.applicationGuildCommand(this.applicationId, guildId, commandId)
        ) as RESTGetAPIApplicationCommandResult
    }

    async editCommand(commandId: string, command: RESTPatchAPIApplicationCommandJSONBody) {
        return await this.rest.patch(
            Routes.applicationCommand(this.applicationId, commandId),
            { body: command }
        ) as RESTPatchAPIApplicationCommandResult
    }

    async editGuildCommand(guildId: string, commandId: string, command: RESTPatchAPIApplicationGuildCommandJSONBody) {
        return await this.rest.patch(
            Routes.applicationGuildCommand(this.applicationId, guildId, commandId),
            { body: command }
        ) as RESTPatchAPIApplicationGuildCommandResult
    }

    async deleteCommand(commandId: string) {
        await this.rest.delete(
            Routes.applicationCommand(this.applicationId, commandId)
        )
    }
    
    async deleteGuildCommand(guildId: string, commandId: string) {
        await this.rest.delete(
            Routes.applicationGuildCommand(this.applicationId, guildId, commandId)
        )
    }

    async updateCommands(commands: RESTPutAPIApplicationCommandsJSONBody) {
        return await this.rest.put(
            Routes.applicationCommands(this.applicationId),
            { body: commands }
        ) as RESTPutAPIApplicationCommandsResult
    }

    async updateGuildCommands(guildId: string, commands: RESTPutAPIApplicationGuildCommandsJSONBody) {
        return await this.rest.put(
            Routes.applicationGuildCommands(this.applicationId, guildId),
            { body: commands }
        ) as RESTPutAPIApplicationGuildCommandsResult
    }

    async syncCommands() {
        const getCommands = <C extends Command | GuildCommand>(commands: Commands<C>) => {
            return Array.from(commands.values()).flatMap(v => Array.from(v.values(), c => c.data))
        }
        const r = await Promise.allSettled([
            this.updateCommands(getCommands(this.commands)),
            ...Array.from(this.guildCommands, ([g, c]) => this.updateGuildCommands(g, getCommands(c)))
        ])
    }

    private async sendCallback(
        interaction: APIInteraction,
        body: APIInteractionResponse
    ) {
        await this.rest.post(
            Routes.interactionCallback(interaction.id, interaction.token),
            { body }
        )
    }

    async sendReply(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
        message: APIInteractionResponseCallbackData,
        ephemeral: boolean = false
    ) {
        if (ephemeral) {
            if (message.flags) {
                message.flags |= MessageFlags.Ephemeral
            } else {
                message.flags = MessageFlags.Ephemeral
            }
        }
        const body: APIInteractionResponseChannelMessageWithSource = {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: message
        }
        await this.sendCallback(interaction, body)
    }

    async deferReply(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
        ephemeral: boolean = false
    ) {
        const body: APIInteractionResponseDeferredChannelMessageWithSource = {
            type: InteractionResponseType.DeferredChannelMessageWithSource,
            data: {
                flags: ephemeral ? MessageFlags.Ephemeral : undefined
            }
        }
        await this.sendCallback(interaction, body)
    }

    async deferUpdate(
        interaction: APIMessageComponentInteraction
    ) {
        const body: APIInteractionResponseDeferredMessageUpdate = {
            type: InteractionResponseType.DeferredMessageUpdate
        }
        await this.sendCallback(interaction, body)
    }

    async sendUpdate(
        interaction: APIMessageComponentInteraction,
        message: APIInteractionResponseCallbackData,
    ) {
        const body: APIInteractionResponseUpdateMessage = {
            type: InteractionResponseType.UpdateMessage,
            data: message
        }
        await this.sendCallback(interaction, body)
    }

    async sendModal(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction,
        modal: APIModalInteractionResponseCallbackData
    ) {
        const body: APIModalInteractionResponse = {
            type: InteractionResponseType.Modal,
            data: modal
        }
        await this.sendCallback(interaction, body)
    }

    async fetchReply(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction
    ) {
        return await this.rest.get(
            Routes.webhookMessage(this.applicationId, interaction.token)
        ) as RESTGetAPIWebhookWithTokenMessageResult
    }

    async editReply(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
        message: RESTPatchAPIWebhookWithTokenMessageJSONBody
    ) {
        return await this.rest.patch(
            Routes.webhookMessage(this.applicationId, interaction.token),
            { body: message }
        ) as RESTPatchAPIWebhookWithTokenMessageResult
    }

    async deleteReply(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction
    ) {
        await this.rest.delete(
            Routes.webhookMessage(this.applicationId, interaction.token)
        )
    }

    async sendFollowup(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
        message: RESTPostAPIWebhookWithTokenJSONBody,
        ephemeral: boolean = false
    ) {
        if (ephemeral) {
            if (message.flags) {
                message.flags |= MessageFlags.Ephemeral
            } else {
                message.flags = MessageFlags.Ephemeral
            }
        }
        return await this.rest.post(
            Routes.webhook(this.applicationId, interaction.token),
            { body: message }
        ) as APIMessage
    }

    async fetchFollowup(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
        messageId: string
    ) {
        return await this.rest.get(
            Routes.webhookMessage(this.applicationId, interaction.token, messageId)
        ) as RESTGetAPIWebhookWithTokenMessageResult
    }

    async editFollowup(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
        messageId: string,
        message: RESTPatchAPIWebhookWithTokenMessageJSONBody
    ) {
        return await this.rest.patch(
            Routes.webhookMessage(this.applicationId, interaction.token, messageId),
            { body: message }
        ) as RESTPatchAPIWebhookWithTokenMessageResult
    }

    async deleteFollowup(
        interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction | APIModalSubmitInteraction,
        messageId: string
    ) {
        await this.rest.delete(
            Routes.webhookMessage(this.applicationId, interaction.token, messageId)
        )
    }

    private verify() {
        return (req: Request, res: Response, next: NextFunction) => {
            const abort = () => {
                res.sendStatus(401).end()
            }

            const signature = req.get('X-Signature-Ed25519')
            const timestamp = req.get('X-Signature-Timestamp')

            if (signature === undefined || timestamp === undefined) {
                abort()
                return
            }

            const onBodyComplete = (rawBody: string) => {
                try {
                    const isVerified = nacl.sign.detached.verify(
                        Buffer.from(timestamp+rawBody),
                        Buffer.from(signature, 'hex'),
                        Buffer.from(this.publicKey, 'hex')
                    )
                    if (isVerified) {
                        req.body = JSON.parse(rawBody)
                        next()
                    } else {
                        abort()
                    }
                } catch (e) {
                    abort()
                }
            }

            if (req.body) {
                if (typeof req.body === 'string') {
                    onBodyComplete(req.body)
                } else if (Buffer.isBuffer(req.body)) {
                    onBodyComplete(req.body.toString())
                } else {
                    onBodyComplete(JSON.stringify(req.body))
                }
            } else {
                let rawBody = ''
                req.on('data', chunk => {
                    rawBody += chunk.toString()
                })
                req.on('end', () => {
                    onBodyComplete(rawBody)
                })
            }
        }
    }

    private handleInteraction() {
        return async (req: Request, res: Response) => {
            const interaction = req.body as APIInteraction
            switch (interaction.type) {
            case InteractionType.Ping:
                const pong: APIInteractionResponsePong = {
                    type: InteractionResponseType.Pong
                }
                res.json(pong).end()
                return
            case InteractionType.ApplicationCommand:
                res.status(204)
                await this.handleApplicationCommand(interaction)
                return
            case InteractionType.MessageComponent:
                res.status(204)
                await this.interactionHandler(this, interaction)
                return
            case InteractionType.ApplicationCommandAutocomplete:
                const autocompleteData = await this.handleAutocomplete(interaction)
                if (autocompleteData === undefined) {
                    res.status(204)
                } else {
                    const autocomplete: APIApplicationCommandAutocompleteResponse = {
                        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
                        data: autocompleteData
                    }
                    res.json(autocomplete)
                }
                return
            case InteractionType.ModalSubmit:
                res.status(204)
                await this.interactionHandler(this, interaction)
                return
            }
        }
    }

    private async handleApplicationCommand(
        interaction: APIApplicationCommandInteraction
    ) {
        const handler = (interaction.guild_id
            ? this.guildCommands.get(interaction.guild_id)
            : this.commands)
            ?.get(interaction.data.type)
            ?.get(interaction.data.name)
            ?.handler
        if (handler) {
            await handler(this, interaction)
        } else {
            await this.interactionHandler(this, interaction)
        }
    }

    private async handleAutocomplete(
        interaction: APIApplicationCommandAutocompleteInteraction
    ) {
        const handler = (interaction.guild_id
            ? this.guildCommands.get(interaction.guild_id)
            : this.commands)
            ?.get(interaction.data.type)
            ?.get(interaction.data.name)
            ?.autocompleteHandler
        if (handler) {
            return await handler(interaction)
        } else {
            return await this.autocompleteHandler(interaction)
        }
    }

    serve(path: string, port: number) {
        const app = express()
        app.use((err: any, req: Request, res: Response, next: NextFunction) => {
            res.sendStatus(500).end()
            console.error(err)
            next(err)
        })
        app.post(path, this.handlers)
        app.listen(port)
    }
}
