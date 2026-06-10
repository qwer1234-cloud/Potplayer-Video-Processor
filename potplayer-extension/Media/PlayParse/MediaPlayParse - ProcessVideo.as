/*
  ProcessVideo PotPlayer bridge.
  This extension stays thin: it launches the local companion and lets PotPlayer keep playing the original media.
  Development companion: processvideo-cli.js.
*/

string CONFIG_SECTION = "PROCESSVIDEO";

string GetTitle()
{
  return "ProcessVideo";
}

string GetVersion()
{
  return "1";
}

string GetDesc()
{
  return "Launch ProcessVideo companion for local PotPlayer bookmark GIF generation.";
}

string QuoteArg(const string &in value)
{
  string escaped = value;
  escaped.replace("\"", "\\\"");
  return "\"" + escaped + "\"";
}

string ReadConfigString(const string &in key, const string &in fallback)
{
  IniFile ini;
  bool ok = false;
  string scriptFolder = HostGetScriptFolder();

  if (ini.Open(scriptFolder + "\\ProcessVideo.ini") || ini.Open(scriptFolder + "\\ProcessVideo_default.ini"))
  {
    return ini.GetProfileString(CONFIG_SECTION, key, fallback, ok);
  }

  return fallback;
}

int ReadConfigInt(const string &in key, int fallback)
{
  IniFile ini;
  bool ok = false;
  string scriptFolder = HostGetScriptFolder();

  if (ini.Open(scriptFolder + "\\ProcessVideo.ini") || ini.Open(scriptFolder + "\\ProcessVideo_default.ini"))
  {
    return ini.GetProfileInt(CONFIG_SECTION, key, fallback, ok);
  }

  return fallback;
}

bool IsLocalVideo(const string &in path)
{
  if (path.find("://") >= 0)
  {
    return false;
  }

  return HostFileExist(path) && HostCheckMediaFile(path, true, false, false);
}

string InferPBFPath(const string &in videoPath)
{
  int lastDot = -1;
  int lastSlash = -1;

  for (int i = 0; i < int(videoPath.size()); i++)
  {
    string ch = videoPath.substr(i, 1);
    if (ch == "\\" || ch == "/")
    {
      lastSlash = i;
    }
    else if (ch == ".")
    {
      lastDot = i;
    }
  }

  if (lastDot > lastSlash)
  {
    return videoPath.substr(0, lastDot) + ".pbf";
  }

  return videoPath + ".pbf";
}

bool HasRequiredPBF(const string &in videoPath)
{
  int requirePBF = ReadConfigInt("require_pbf_exists", 1);
  if (requirePBF == 0)
  {
    return true;
  }

  string pbfPath = InferPBFPath(videoPath);
  if (HostFileExist(pbfPath))
  {
    return true;
  }

  HostPrintUTF8("ProcessVideo skipped because matching PBF was not found: " + pbfPath);
  return false;
}

bool ShouldThrottleLaunch(const string &in videoPath)
{
  int cooldownSeconds = ReadConfigInt("cooldown_seconds", 30);
  if (cooldownSeconds <= 0)
  {
    return false;
  }

  string key = "ProcessVideo.LastLaunch." + HostHashMD5(videoPath);
  int nowTick = HostGetTickCount();
  int lastTick = HostLoadInteger(key, 0);

  if (lastTick > 0 && nowTick >= lastTick && nowTick - lastTick < cooldownSeconds * 1000)
  {
    return true;
  }

  HostSaveInteger(key, nowTick);
  return false;
}

string BuildAsyncLaunchParam(const string &in exeName, const string &in exeParam)
{
  return "/d /s /c start \"\" /b " + QuoteArg(exeName) + " " + exeParam;
}

void LaunchProcessVideo(const string &in videoPath)
{
  string mode = ReadConfigString("mode", "bookmark-gif");
  string companionPath = ReadConfigString("companion_path", "");
  string nodePath = ReadConfigString("node_path", "node");
  string reportPath = ReadConfigString("report_path", "");
  int openUi = ReadConfigInt("open_ui_after_start", 0);
  int showMessage = ReadConfigInt("show_launch_message", 1);
  int asyncLaunch = ReadConfigInt("async_launch", 1);

  if (companionPath.empty())
  {
    HostMessageBox("ProcessVideo companion_path is empty. Edit ProcessVideo.ini first.", "ProcessVideo", 3, 0);
    return;
  }

  if (ShouldThrottleLaunch(videoPath))
  {
    HostPrintUTF8("ProcessVideo launch skipped by cooldown: " + videoPath);
    return;
  }

  string exeName = companionPath;
  string exeParam = mode + " --video " + QuoteArg(videoPath);

  if (reportPath.empty() == false)
  {
    exeParam += " --report " + QuoteArg(reportPath);
  }

  if (openUi != 0)
  {
    exeParam += " --open-ui";
  }

  string lowerCompanion = companionPath;
  lowerCompanion.MakeLower();
  if (lowerCompanion.Right(3) == ".js")
  {
    exeName = nodePath;
    exeParam = QuoteArg(companionPath) + " " + exeParam;
  }
  else
  {
    exeParam = "--processvideo-cli " + exeParam;
  }

  HostPrintUTF8("ProcessVideo launch: " + exeName + " " + exeParam);
  string result = "";
  if (asyncLaunch != 0)
  {
    result = HostExecuteProgram("cmd.exe", BuildAsyncLaunchParam(exeName, exeParam));
  }
  else
  {
    result = HostExecuteProgram(exeName, exeParam);
  }
  HostPrintUTF8("ProcessVideo result: " + result);

  if (showMessage != 0)
  {
    HostMessageBox("ProcessVideo companion queued. Check the configured report or output folder.", "ProcessVideo", 2, 0);
  }
}

bool PlayitemCheck(const string &in path)
{
  return IsLocalVideo(path) && HasRequiredPBF(path);
}

string PlayitemParse(const string &in path, dictionary &MetaData, array<dictionary> &QualityList)
{
  if (IsLocalVideo(path) && HasRequiredPBF(path))
  {
    LaunchProcessVideo(path);
  }

  return path;
}
