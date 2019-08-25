Making code faster - the go tools story.
-- make some cool entrance

0. describe problem
1. put code here of super slow execution
2. put code with a bit better execution (with strbuilder)
3. put code with goroutines
4. introduce trace
5. introduce better concurrency
6. introduce pprof
	make joke about hacker terminal vs visual
7. make some changes
8. show its faster
9. mention final version

https://ayende.com/blog/176034/making-code-faster-the-interview-question

```
2015-01-01T16:44:31 2015-01-01T19:09:14 00043064
2015-01-01T04:20:01 2015-01-01T05:04:50 00192676
2015-01-01T09:07:08 2015-01-01T10:32:53 00165147
2015-01-01T00:43:35 2015-01-01T01:01:05 00184024
2015-01-01T20:31:41 2015-01-01T22:39:05 00098557
2015-01-01T14:01:02 2015-01-01T15:26:16 00019519
2015-01-01T10:56:23 2015-01-01T12:23:57 00112591
2015-01-01T11:55:57 2015-01-01T12:47:59 00052067
2015-01-01T01:31:48 2015-01-01T03:28:07 00181835
2015-01-01T10:12:43 2015-01-01T12:36:07 00135455
```


```go
type carRecord struct {
	Start time.Time
	End   time.Time
	ID    int
}

func newCarRecord(line string) carRecord {
	parts := strings.Split(line, " ")

	start, _ := time.Parse("2006-01-02T15:04:05", parts[0])
	end, _ := time.Parse("2006-01-02T15:04:05", parts[1])
	id, _ := strconv.Atoi(parts[2])

	return carRecord{start, end, id}
}

func report(in, out string) {
	bytes, _ := ioutil.ReadFile(in)
	content := string(bytes)
	lines := strings.Split(content, "\r\n")

	durations := make(map[int]float64)

	for _, line := range lines {
		if line != "" {
			record := newCarRecord(line)
			duration := record.End.Sub(record.Start).Seconds()
			if _, ok := durations[record.ID]; ok {
				durations[record.ID] += duration
			} else {
				durations[record.ID] = duration
			}
		}
	}

	var sb strings.Builder
	for id, duration := range durations {
		sb.WriteString(fmt.Sprintf("%d %.0f\r\n", id, duration))
	}

	ioutil.WriteFile(out, []byte(sb.String()), 0644)
}
```
above takes around 5,6 s
fun fuct try to replace string.Builder with string concatenation like this:
```go
output := ""
for id, duration := range durations {
	output += fmt.Sprintf("%d %.0f\r\n", id, duration)
}
```
and see what happens, spoiler alert: it then takes around 50s to execute
I guess its true what some dude on the internet said:
> Unnecessary allocation is a bitch

Lets make it concurrent

```go
func report(inFileName, outFileName string) {
	bytes, _ := ioutil.ReadFile(inFileName)
	content := string(bytes)
	lines := strings.Split(content, "\r\n")

	durations := make(map[int]float64)
	wg := sync.WaitGroup{}
	mu := sync.Mutex{}
	noOfWorkers := 4
	cWork := make(chan []string, 100)

	for i := 0; i < noOfWorkers; i++ {
		go func() {
			for dataBatch := range cWork {
				for x := 0; x < len(dataBatch); x++ {
					line := dataBatch[x]
					record := newCarRecord(line)
					duration := record.End.Sub(record.Start).Seconds()
					mu.Lock()
					durations[record.ID] += duration
					mu.Unlock()
				}
			}

			wg.Done()
		}()
	}

	wg.Add(noOfWorkers)

	noOfLines := len(lines) - 1 // because we know that the last line is empty
	batchSize := 100000
	noOfBatches := int(noOfLines / batchSize)

	for x := 0; x < noOfBatches; x++ {
		startAt := x * batchSize
		cWork <- lines[startAt : startAt+batchSize]
	}

	if noOfBatches*batchSize < noOfLines {
		cWork <- lines[noOfBatches*batchSize : noOfLines]
	}

	close(cWork)

	wg.Wait()

	var sb strings.Builder
	for id, duration := range durations {
		sb.WriteString(fmt.Sprintf("%d %.0f\r\n", id, duration))
	}

	ioutil.WriteFile(outFileName, []byte(sb.String()), 0644)
}
```

TODO: ble ble write benchmark ble ble 

```go
package main

import "testing"

func BenchmarkReport(b *testing.B) {
	for n := 0; n < b.N; n++ {
		report("data.txt", "summary.txt")
	}
}
```

TODO: ble ble benchstat bleble

TODO: ble ble trace ble ble
![trace_concurrent_1.png](trace_concurrent_1.png)

a lot of locks bleble and also 1 sec just reading file so lets try to change it a bit 

```go
func report(in, out string) {
	inFile, _ := os.Open(in)
	defer inFile.Close()

	durations := make(map[int]float64)

	lineLen := 50
	dataInLineLen := 48 // dont count \r\n
	noOfWorkers := 4
	cWork := make(chan []byte, 100)
	cDurations := make(chan map[int]float64, noOfWorkers)
	wg := sync.WaitGroup{}

	for i := 0; i < noOfWorkers; i++ {
		go func() {
			localDurations := make(map[int]float64)
			for dataRange := range cWork {
				for x := 0; x < len(dataRange); x += lineLen {
					line := string(dataRange[x : x+dataInLineLen])
					record := newCarRecord(line)
					duration := record.End.Sub(record.Start).Seconds()
					localDurations[record.ID] += duration
				}
			}
			cDurations <- localDurations
			wg.Done()
		}()
	}

	wg.Add(noOfWorkers)

	batchSize := 100000

	for {
		buf := make([]byte, batchSize)
		read, err := inFile.Read(buf)

		if err == io.EOF {
			break
		}

		cWork <- buf[:read]
	}

	close(cWork)

	wg.Wait()

	for i := 0; i < noOfWorkers; i++ {
		d := <-cDurations
		for id, duration := range d {
			durations[id] += duration
		}
	}

	var sb strings.Builder
	for id, duration := range durations {
		sb.WriteString(fmt.Sprintf("%d %.0f\r\n", id, duration))
	}

	ioutil.WriteFile(out, []byte(sb.String()), 0644)
}
```

takes around 3s, lets take a look (entering pprof + web with flame graphs)

command line like a boss

```bash
> go tool pprof cpu.out 
File: making-code-faster.test
Type: cpu
Time: Aug 25, 2019 at 12:30pm (CEST)
Duration: 2.95s, Total samples = 6.67s (225.96%)
Entering interactive mode (type "help" for commands, "o" for options)
(pprof) top
Showing nodes accounting for 4890ms, 73.31% of 6670ms total
Dropped 68 nodes (cum <= 33.35ms)
Showing top 10 nodes out of 60
      flat  flat%   sum%        cum   cum%
    1730ms 25.94% 25.94%     4010ms 60.12%  time.parse
     980ms 14.69% 40.63%      980ms 14.69%  time.nextStdChunk
     720ms 10.79% 51.42%      880ms 13.19%  runtime.mapassign_fast64
     360ms  5.40% 56.82%      360ms  5.40%  time.skip
     240ms  3.60% 60.42%      270ms  4.05%  runtime.heapBitsSetType
     230ms  3.45% 63.87%      410ms  6.15%  time.Date
     190ms  2.85% 66.72%      710ms 10.64%  runtime.mallocgc
     150ms  2.25% 68.97%     4980ms 74.66%  github.com/michaldziurowski/making-code-faster.newCarRecord
     150ms  2.25% 71.21%      270ms  4.05%  time.getnum
     140ms  2.10% 73.31%      140ms  2.10%  time.isDigit
(pprof) 

```

web view

![pprof_web_view.png](pprof_web_view.png)

flame graph 

![pprof_flame_graph.png](pprof_flame_graph.png)

What we learned is that our program spends much time in time.parse. It seems that we could do substraction by ourselfs and see it that helps

```go
func newCarRecord(b []byte) (int, float64) {
	start := parseTime(b[:19])
	end := parseTime(b[20:39])
	id := from8Bytes(b[40:48])

	return id, end.Sub(start).Seconds()
}

func parseTime(b []byte) time.Time {
	y := from4Bytes(b[:4])
	m := time.Month(from2Bytes(b[5:7]))
	d := from2Bytes(b[8:10])
	h := from2Bytes(b[11:13])
	mi := from2Bytes(b[14:16])
	s := from2Bytes(b[17:19])
	return time.Date(y, m, d, h, mi, s, 0, time.UTC)
}

func from2Bytes(by []byte) int {
	return int(by[0]-'0')*10 + int(by[1]-'0')
}

func from4Bytes(by []byte) int {
	return int(by[0]-'0')*1000 + int(by[1]-'0')*100 + int(by[2]-'0')*10 + int(by[3]-'0')
}

func from8Bytes(by []byte) int {
	return int(by[0]-'0')*10000000 + int(by[1]-'0')*1000000 + int(by[2]-'0')*1000000 + int(by[3]-'0')*10000 + int(by[4]-'0')*1000 + int(by[5]-'0')*100 + int(by[6]-'0')*10 + int(by[7]-'0')
}
```

seems ugly but runs in ~0,75s
