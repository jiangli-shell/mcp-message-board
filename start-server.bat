@echo off
echo ================================
echo MCP 留言板服务器启动脚本
echo ================================
echo.

cd /d "%~dp0server"

if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败！
        pause
        exit /b 1
    )
)

if not exist "dist" (
    echo 正在编译 TypeScript...
    call npm run build
    if errorlevel 1 (
        echo 编译失败！
        pause
        exit /b 1
    )
)

echo.
echo 启动服务器 (SSE 模式)...
echo 网页留言板: http://localhost:3000
echo SSE 端点: http://localhost:3000/sse
echo.
set MCP_MODE=sse
call npm start

pause
