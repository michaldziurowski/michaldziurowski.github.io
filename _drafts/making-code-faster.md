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





