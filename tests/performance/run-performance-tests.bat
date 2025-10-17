@echo off
REM 性能测试运行脚本 (Windows)
REM 执行所有性能测试并生成报告

setlocal enabledelayedexpansion

set TESTS_DIR=%~dp0
set RESULTS_DIR=%TESTS_DIR%results
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set DATESTAMP=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set TIMESTAMP=%%a-%%b)
set TIMESTAMP=%DATESTAMP%_%TIMESTAMP%

REM 创建结果目录
if not exist "%RESULTS_DIR%" mkdir "%RESULTS_DIR%"

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     密钥销售平台 - 性能压力测试                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM 检查后端是否运行
echo 检查后端服务...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/api/products' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }"

if %ERRORLEVEL% NEQ 0 (
  echo ❌ 后端服务未启动
  echo 请先运行: cd backend ^&^& npm run dev
  exit /b 1
)
echo ✅ 后端服务正常运行
echo.

REM 测试1: k6 大数据量查询性能测试
echo ════════════════════════════════════════════════════════════
echo 测试1: 大数据量查询性能测试
echo ════════════════════════════════════════════════════════════
echo 配置: 10-50-100 虚拟用户，逐步增压
echo.

set K6_RESULT=%RESULTS_DIR%\k6-query-test_%TIMESTAMP%.json
echo 运行 k6 测试... (这可能需要 3-5 分钟)
echo.

k6 run "%TESTS_DIR%k6-query-load-test.js" --vus 10 --duration 30s --summary-export="%K6_RESULT%"

if exist "%K6_RESULT%" (
  echo.
  echo ✅ k6 测试完成
  echo    结果保存至: %K6_RESULT%
) else (
  echo ⚠️  k6 测试未生成结果文件
)
echo.

REM 测试2: Artillery 高并发订单测试
echo ════════════════════════════════════════════════════════════
echo 测试2: 高并发订单创建压力测试
echo ════════════════════════════════════════════════════════════
echo 配置: 预热(1req/s) ^→ 逐步增加(25-50req/s) ^→ 持续压力(50req/s) ^→ 冷却
echo.

set ARTILLERY_RESULT=%RESULTS_DIR%\artillery-order-test_%TIMESTAMP%.json
echo 运行 Artillery 测试... (这可能需要 5-10 分钟)
echo.

artillery run "%TESTS_DIR%artillery-order-load-test.yml" --output "%ARTILLERY_RESULT%"

if exist "%ARTILLERY_RESULT%" (
  echo.
  echo ✅ Artillery 测试完成
  echo    结果保存至: %ARTILLERY_RESULT%
) else (
  echo ⚠️  Artillery 测试未生成结果文件
)
echo.

REM 生成性能测试报告
echo ════════════════════════════════════════════════════════════
echo 性能测试完成！
echo ════════════════════════════════════════════════════════════
echo.
echo 📊 结果文件:
echo    - k6: %K6_RESULT%
echo    - Artillery: %ARTILLERY_RESULT%
echo.
echo 查看结果:
echo    k6 结果可以在 Artillery 结果 JSON 中查看详细数据
echo    建议使用在线工具分析结果: https://k6.io/docs/results-output/
echo.

pause
