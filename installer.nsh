; NSIS 自定义脚本

!macro customInstall
  ; 复制 CLI 启动脚本
  File /oname=$INSTDIR\llm-router-cli.bat "cli\llm-router-cli.bat"
!macroend

!macro customUnInstall
  ; 删除 CLI 脚本
  Delete "$INSTDIR\llm-router-cli.bat"
!macroend
