-- KEYS[1]: rate limit key
-- ARGV[1]: max requests
-- ARGV[2]: window in seconds
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call('GET', key)
if current and tonumber(current) >= limit then
    return 0
end
local count = redis.call('INCR', key)
if count == 1 then
    redis.call('EXPIRE', key, window)
end
return 1
