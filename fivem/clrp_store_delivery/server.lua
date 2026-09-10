local Proxy = module('lib/Proxy')
local vRP = Proxy.getInterface('vRP')
local Inventory = exports['snt-inventory']
local Garage = exports['snt-vehicles']
local Database = exports.oxmysql

local function post(path, body, cb)
  PerformHttpRequest(Config.ApiUrl .. path, function(status, data)
    cb(status, data)
  end, 'POST', json.encode(body or {}), {
    ['Content-Type']='application/json', ['x-delivery-secret']=Config.Secret
  })
end

local function setCharacterGroupTime(id, group, days)
  if days <= 0 then
    Database:execute('DELETE FROM `characters_groups` WHERE `id` = ? AND `group` = ?', { id, group })
    return
  end

  local now = os.time()
  local startedAt = now
  local expireAt = now + (days * 86400)
  local result = Database:query_async('SELECT * FROM `characters_groups` WHERE `id` = ? AND `group` = ?', { id, group })

  if type(result) == 'table' and result[1] then
    local existingExpire = tonumber(result[1].expire_at)
    local existingStart = tonumber(result[1].started_at)
    if existingExpire and existingExpire > now then
      expireAt = existingExpire + (days * 86400)
      startedAt = existingStart or now
    end
  end

  Database:execute(
    'INSERT INTO `characters_groups` (`id`, `group`, `started_at`, `expire_at`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `started_at` = ?, `expire_at` = ?',
    { id, group, startedAt, expireAt, startedAt, expireAt }
  )
end

local function removeExpiredGroups()
  local now = os.time()
  local rows = Database:query_async('SELECT * FROM `characters_groups` WHERE `expire_at` IS NOT NULL AND `expire_at` <= ?', { now })
  if type(rows) == 'table' then
    for _, row in ipairs(rows) do
      vRP.removeCharacterGroup(row.id, row.group)
      Database:execute('DELETE FROM `characters_groups` WHERE `id` = ? AND `group` = ?', { row.id, row.group })
    end
  end
end

local function executeDelivery(d)
  local id = parseInt(d.character_id)
  local amount = parseInt(d.delivery_amount or 1)
  local days = parseInt(d.delivery_days or 0)
  if id <= 0 then return false, 'character_id invalido' end
  if d.delivery_type == 'item' then
    local ok, result = Inventory:addInventoryItem(id, d.delivery_value, amount, true)
    return ok == true, tostring(result or '')
  elseif d.delivery_type == 'vehicle' then
    if days > 0 then
      local hasRented, rentalPlate = Garage:hasVehicleModelRented(id, d.delivery_value)
      if hasRented then
        Garage:forceLoadVehicleByPlate(rentalPlate)
        local ok, result = Garage:updateRentalVehicleDays(rentalPlate, days)
        return ok == true, tostring(result or 'rental renewed')
      end
      local ok, result = Garage:generateRentalVehicle(id, d.delivery_value, days)
      return ok == true, tostring(result or 'rental vehicle')
    end
    local ok, result = Garage:generateVehicle(id, d.delivery_value)
    return ok == true, tostring(result or 'vehicle')
  elseif d.delivery_type == 'group' then
    vRP.addCharacterGroup(id, d.delivery_value)
    setCharacterGroupTime(id, d.delivery_value, days)
    return true, 'group'
  elseif d.delivery_type == 'coins' then
    vRP.addCash(id, amount)
    return true, 'coins'
  end
  return false, 'tipo de entrega desconhecido'
end

CreateThread(function()
  while Config.Secret == '' do
    print('[clrp_store_delivery] Configure setr clrp_store_delivery_secret no server.cfg')
    Wait(30000)
  end
end)

CreateThread(function()
  while true do
    if Config.Secret ~= '' then
      post('/claim', { limit = Config.BatchSize }, function(status, data)
        if status == 200 and data then
          local rows = json.decode(data) or {}
          for _, d in ipairs(rows) do
            local ok, err = pcall(executeDelivery, d)
            local delivered = ok and err ~= false
            if delivered then
              post('/' .. d.id .. '/complete', {}, function() end)
            else
              post('/' .. d.id .. '/fail', { error = tostring(err) }, function() end)
            end
          end
        end
      end)
    end
    Wait(Config.PollMs)
  end
end)


CreateThread(function()
  Database:execute('CREATE TABLE IF NOT EXISTS `characters_groups` (`id` int(11) NOT NULL, `group` varchar(255) NOT NULL, `started_at` bigint(20) DEFAULT NULL, `expire_at` bigint(20) DEFAULT NULL, UNIQUE KEY `unique_character_group` (`id`, `group`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;')
  while true do
    Wait(300000)
    removeExpiredGroups()
  end
end)

RegisterServerEvent('SNT/C/setReady')
AddEventHandler('SNT/C/setReady', function(src, characterId)
  SetTimeout(2000, function()
    local now = os.time()
    local rows = Database:query_async('SELECT * FROM `characters_groups` WHERE `id` = ? AND `expire_at` IS NOT NULL AND `expire_at` <= ?', { characterId, now })
    if type(rows) == 'table' then
      for _, row in ipairs(rows) do
        vRP.removeCharacterGroup(characterId, row.group)
        Database:execute('DELETE FROM `characters_groups` WHERE `id` = ? AND `group` = ?', { characterId, row.group })
      end
    end
  end)
end)
