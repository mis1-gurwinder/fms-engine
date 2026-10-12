Write-Host "Starting FMS Engine demo..."
Start-Process powershell -ArgumentList '-NoExit','-Command',"Set-Location '$PSScriptRoot/server'; npm install; npm run dev"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList '-NoExit','-Command',"Set-Location '$PSScriptRoot/client'; npm install; npm run dev"
Write-Host "Frontend: http://localhost:5173"
