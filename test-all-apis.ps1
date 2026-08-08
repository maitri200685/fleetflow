$base = "http://localhost:5000/api"

$results = @()

function Test-Api {
    param (
        [string]$Name,
        [string]$Method,
        [string]$Uri,
        [object]$Body = $null
    )

    try {
        if ($Body) {
            $response = Invoke-RestMethod `
                -Uri $Uri `
                -Method $Method `
                -ContentType "application/json" `
                -Body ($Body | ConvertTo-Json -Depth 10)
        }
        else {
            $response = Invoke-RestMethod `
                -Uri $Uri `
                -Method $Method
        }

        Write-Host "PASS: $Name" -ForegroundColor Green

        $script:results += [PSCustomObject]@{
            Test = $Name
            Status = "PASS"
            Message = $response.message
        }

        return $response
    }
    catch {
        Write-Host "FAIL: $Name" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow

        $script:results += [PSCustomObject]@{
            Test = $Name
            Status = "FAIL"
            Message = $_.ErrorDetails.Message
        }

        return $null
    }
}


Write-Host ""
Write-Host "========================================="
Write-Host "       FLEETFLOW BACKEND TEST"
Write-Host "========================================="
Write-Host ""


# ==========================================
# VEHICLES
# ==========================================

Write-Host "========== VEHICLES ==========" -ForegroundColor Cyan

$vehicles = Test-Api `
    "GET Vehicles" `
    "GET" `
    "$base/vehicles"


# ==========================================
# DRIVERS
# ==========================================

Write-Host ""
Write-Host "========== DRIVERS ==========" -ForegroundColor Cyan

$drivers = Test-Api `
    "GET Drivers" `
    "GET" `
    "$base/drivers"


# ==========================================
# CUSTOMERS
# ==========================================

Write-Host ""
Write-Host "========== CUSTOMERS ==========" -ForegroundColor Cyan

$customers = Test-Api `
    "GET Customers" `
    "GET" `
    "$base/customers"


# ==========================================
# TRIPS
# ==========================================

Write-Host ""
Write-Host "========== TRIPS ==========" -ForegroundColor Cyan

$trips = Test-Api `
    "GET Trips" `
    "GET" `
    "$base/trips"


# ==========================================
# MAINTENANCE
# ==========================================

Write-Host ""
Write-Host "========== MAINTENANCE ==========" -ForegroundColor Cyan

$maintenance = Test-Api `
    "GET Maintenance" `
    "GET" `
    "$base/maintenance"


# ==========================================
# FUEL
# ==========================================

Write-Host ""
Write-Host "========== FUEL ==========" -ForegroundColor Cyan

$fuel = Test-Api `
    "GET Fuel Records" `
    "GET" `
    "$base/fuel"


# ==========================================
# EXPENSES
# ==========================================

Write-Host ""
Write-Host "========== EXPENSES ==========" -ForegroundColor Cyan

$expenses = Test-Api `
    "GET Expenses" `
    "GET" `
    "$base/expenses"


# ==========================================
# DOCUMENTS
# ==========================================

Write-Host ""
Write-Host "========== DOCUMENTS ==========" -ForegroundColor Cyan

$documents = Test-Api `
    "GET Documents" `
    "GET" `
    "$base/documents"


# ==========================================
# NOTIFICATIONS
# ==========================================

Write-Host ""
Write-Host "========== NOTIFICATIONS ==========" -ForegroundColor Cyan

$notifications = Test-Api `
    "GET Notifications" `
    "GET" `
    "$base/notifications"


# ==========================================
# FINAL RESULTS
# ==========================================

Write-Host ""
Write-Host "========================================="
Write-Host "             TEST RESULTS"
Write-Host "========================================="

$results | Format-Table -AutoSize

$passed = ($results | Where-Object {$_.Status -eq "PASS"}).Count
$failed = ($results | Where-Object {$_.Status -eq "FAIL"}).Count

Write-Host ""
Write-Host "PASSED: $passed" -ForegroundColor Green
Write-Host "FAILED: $failed" -ForegroundColor Red

if ($failed -eq 0) {
    Write-Host ""
    Write-Host "ALL BASIC API ROUTES ARE WORKING." -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "SOME APIs FAILED. DO NOT MOVE TO PHASE 3 YET." -ForegroundColor Red
}