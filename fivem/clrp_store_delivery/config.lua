Config = {}
Config.ApiUrl = 'https://api.campolimporp.com.br/api/deliveries'
Config.Secret = GetConvar('clrp_store_delivery_secret', '')
Config.PollMs = 15000
Config.BatchSize = 20
